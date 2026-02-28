/**
 * HTTP transport security utilities.
 *
 * - Origin/Host validation (DNS rebinding protection)
 * - CORS preflight handling
 * - Bearer token authentication (optional)
 * - Simple in-memory rate limiting
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { logMcp } from "./logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpSecurityOptions {
  /**
   * Allowed origins for CORS and DNS rebinding protection.
   * Default: ["http://localhost", "http://127.0.0.1"] + any port variants.
   */
  allowedOrigins?: string[];

  /**
   * Allowed host header values.
   * Default: ["localhost", "127.0.0.1", "[::1]"] + any port variants.
   */
  allowedHosts?: string[];

  /**
   * Optional bearer token for authentication.
   * If set, all requests must include `Authorization: Bearer <token>`.
   * Read from MCP_AUTH_TOKEN env var if not provided.
   */
  authToken?: string;

  /**
   * Rate limit: max requests per window per IP.
   * Default: 100 requests per 60 seconds.
   */
  rateLimitMax?: number;

  /**
   * Rate limit window in milliseconds.
   * Default: 60_000 (60 seconds).
   */
  rateLimitWindowMs?: number;

  /**
   * Enable strict origin checking. When true, requests without
   * a valid Origin header are rejected (except health checks).
   * Default: true.
   */
  strictOriginCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://[::1]",
  "https://[::1]",
];
const DEFAULT_RATE_LIMIT_MAX = 100;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

/** CORS headers exposed to the client per MCP StreamableHTTP spec. */
const MCP_EXPOSED_HEADERS = [
  "mcp-session-id",
  "last-event-id",
  "mcp-protocol-version",
].join(", ");

// ---------------------------------------------------------------------------
// Rate limiter (simple in-memory sliding window)
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

function getRateLimitKey(req: IncomingMessage): string {
  // Use X-Forwarded-For if behind proxy, else remoteAddress
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function checkRateLimit(
  req: IncomingMessage,
  max: number,
  windowMs: number,
): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count++;
  if (bucket.count > max) {
    logMcp("warn", "http.rate_limit_exceeded", { ip: key, count: bucket.count, max });
    return false;
  }
  return true;
}

/** Periodically clean expired rate limit buckets (every 5 minutes). */
let cleanupInterval: ReturnType<typeof setInterval> | undefined;

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of rateLimitStore) {
      if (now > bucket.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60_000);
  // Unref so it doesn't keep the process alive
  cleanupInterval.unref();
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = undefined;
  }
  rateLimitStore.clear();
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function normalizeHostForComparison(host: string): string {
  // Strip port suffix for comparison
  return host.replace(/:\d+$/, "").toLowerCase();
}

function isAllowedHost(host: string | undefined, allowed: string[]): boolean {
  if (!host) return false;
  const normalized = normalizeHostForComparison(host);
  return allowed.some((h) => normalizeHostForComparison(h) === normalized);
}

function isAllowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false;
  // Normalize: strip trailing slash and lowercase
  const normalized = origin.replace(/\/$/, "").toLowerCase();
  return allowed.some((o) => {
    const normalizedAllowed = o.replace(/\/$/, "").toLowerCase();
    // Exact match or match with any port
    if (normalized === normalizedAllowed) return true;
    // Allow any port on the same host (e.g., http://localhost:3000)
    try {
      const url = new URL(normalized);
      const allowedUrl = new URL(normalizedAllowed);
      return url.hostname === allowedUrl.hostname && url.protocol === allowedUrl.protocol;
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function setCorsHeaders(
  res: ServerResponse,
  origin: string | undefined,
  allowedOrigins: string[],
): void {
  const effectiveOrigin =
    origin && isAllowedOrigin(origin, allowedOrigins) ? origin : allowedOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", effectiveOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", MCP_EXPOSED_HEADERS);
  res.setHeader("Access-Control-Max-Age", "86400"); // 24h preflight cache
}

export function handleCorsPreflightIfNeeded(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[],
): boolean {
  if (req.method !== "OPTIONS") return false;

  setCorsHeaders(res, req.headers.origin, allowedOrigins);
  res.writeHead(204);
  res.end();
  return true;
}

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------

export interface HttpSecurityContext {
  allowedOrigins: string[];
  allowedHosts: string[];
  authToken: string | undefined;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  strictOriginCheck: boolean;
}

export function createSecurityContext(options: HttpSecurityOptions = {}): HttpSecurityContext {
  return {
    allowedOrigins: options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS,
    allowedHosts: options.allowedHosts ?? DEFAULT_ALLOWED_HOSTS,
    authToken: options.authToken ?? process.env.MCP_AUTH_TOKEN ?? undefined,
    rateLimitMax: options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX,
    rateLimitWindowMs: options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    strictOriginCheck: options.strictOriginCheck ?? true,
  };
}

/**
 * Validates an incoming HTTP request against security rules.
 * Returns an error message string if the request should be rejected, or undefined if OK.
 */
export function validateRequest(
  req: IncomingMessage,
  ctx: HttpSecurityContext,
  skipOriginCheck = false,
): string | undefined {
  // 1. Rate limiting
  if (!checkRateLimit(req, ctx.rateLimitMax, ctx.rateLimitWindowMs)) {
    return "Rate limit exceeded";
  }

  // 2. Bearer token auth (if configured)
  if (ctx.authToken) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${ctx.authToken}`) {
      logMcp("warn", "http.auth_failed", {
        ip: getRateLimitKey(req),
        hasHeader: !!authHeader,
      });
      return "Unauthorized";
    }
  }

  // 3. Host header validation (DNS rebinding protection)
  const host = req.headers.host;
  if (!isAllowedHost(host, ctx.allowedHosts)) {
    logMcp("warn", "http.invalid_host", { host, allowed: ctx.allowedHosts });
    return "Invalid Host header";
  }

  // 4. Origin validation (skip for health checks and when not strict)
  if (!skipOriginCheck && ctx.strictOriginCheck) {
    const origin = req.headers.origin;
    // Only check if Origin header is present (browsers always send it for CORS)
    if (origin && !isAllowedOrigin(origin, ctx.allowedOrigins)) {
      logMcp("warn", "http.invalid_origin", { origin, allowed: ctx.allowedOrigins });
      return "Invalid Origin header";
    }
  }

  return undefined;
}

/**
 * Send a JSON error response.
 */
export function sendJsonError(
  res: ServerResponse,
  statusCode: number,
  message: string,
  jsonrpcId?: unknown,
): void {
  const body = jsonrpcId !== undefined
    ? JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message },
        id: jsonrpcId,
      })
    : JSON.stringify({ error: message });

  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(body);
}

/**
 * Parse JSON body from an IncomingMessage.
 * Returns the parsed body, or undefined if parsing fails.
 */
export function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const maxSize = 10 * 1024 * 1024; // 10 MB — matches MAX_JSONRPC_MESSAGE_BYTES

    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        req.destroy();
        reject(new Error(`Request body too large: ${totalSize} bytes (limit: ${maxSize})`));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (!raw) {
          resolve(undefined);
          return;
        }
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON in request body"));
      }
    });

    req.on("error", reject);
  });
}
