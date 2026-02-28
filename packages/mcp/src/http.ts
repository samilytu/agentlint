/**
 * HTTP transport for AgentLint MCP server.
 *
 * Uses Node.js native `http` module with `StreamableHTTPServerTransport`
 * from the MCP SDK. No express, no extra dependencies.
 *
 * Features:
 * - Stateful session management via Map<sessionId, transport>
 * - POST/GET/DELETE /mcp → StreamableHTTPServerTransport.handleRequest()
 * - GET /healthz → liveness probe
 * - GET /readyz → readiness probe with session count
 * - Full security middleware integration (CORS, auth, rate limiting, origin/host validation)
 * - Graceful shutdown (SIGINT/SIGTERM)
 *
 * apply_patches is disabled in HTTP mode per great_plan.md §1.3.
 *
 * @module
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { randomUUID } from "node:crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createAgentLintMcpServer } from "./server.js";
import { logMcp } from "./logger.js";
import { applyMessageSizeGuard } from "./transport-security.js";
import {
  createSecurityContext,
  validateRequest,
  setCorsHeaders,
  handleCorsPreflightIfNeeded,
  sendJsonError,
  parseJsonBody,
  startRateLimitCleanup,
  stopRateLimitCleanup,
  type HttpSecurityOptions,
} from "./http-security.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpServerOptions {
  /** TCP port. Default: 3001 or MCP_HTTP_PORT env var. */
  port?: number;

  /** Hostname to bind. Default: "127.0.0.1" (loopback only for safety). */
  hostname?: string;

  /** Security options forwarded to createSecurityContext(). */
  security?: HttpSecurityOptions;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleHealthz(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}

function handleReadyz(_req: IncomingMessage, res: ServerResponse, sessions: Map<string, StreamableHTTPServerTransport>): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ready", sessions: sessions.size }));
}

// ---------------------------------------------------------------------------
// MCP endpoint handler
// ---------------------------------------------------------------------------

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, StreamableHTTPServerTransport>,
): Promise<void> {
  // --- POST: JSON-RPC messages (initialize or subsequent) ------------------
  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bad request body";
      logMcp("warn", "http.body_parse_error", { error: message });
      sendJsonError(res, 400, message);
      return;
    }

    // Check if this is an initialization request → create new transport + session
    if (isInitializeRequest(body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // Apply message size guard
      applyMessageSizeGuard(transport);

      // Create a dedicated MCP server for this session
      const server = createAgentLintMcpServer({
        transportMode: "http",
      });

      // Track session once the transport assigns an ID
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          sessions.delete(sid);
          logMcp("info", "http.session.closed", { sessionId: sid });
        }
      };

      // Connect server to transport (this wires up onmessage etc.)
      await server.connect(transport);

      // Let the transport handle the initialize request
      // (sessionId is assigned during handleRequest, not before)
      await transport.handleRequest(req, res, body);

      // Store session AFTER handleRequest so sessionId is assigned
      const sid = transport.sessionId;
      if (sid) {
        sessions.set(sid, transport);
        logMcp("info", "http.session.created", { sessionId: sid });
      }
      return;
    }

    // Non-init POST: route to existing session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      sendJsonError(res, 400, "Bad Request: Missing or invalid mcp-session-id header");
      return;
    }

    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, body);
    return;
  }

  // --- GET: SSE stream for server-initiated messages -----------------------
  if (req.method === "GET") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      sendJsonError(res, 400, "Bad Request: Missing or invalid mcp-session-id header");
      return;
    }

    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  // --- DELETE: terminate session -------------------------------------------
  if (req.method === "DELETE") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      sendJsonError(res, 404, "Session not found");
      return;
    }

    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  // --- Unsupported method --------------------------------------------------
  res.writeHead(405, { Allow: "GET, POST, DELETE, OPTIONS" });
  res.end();
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Creates and starts the AgentLint MCP HTTP server.
 *
 * Returns the Node.js `http.Server` instance for programmatic control.
 */
export async function runHttpServer(options: HttpServerOptions = {}): Promise<Server> {
  const port = options.port ?? (process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT, 10) : 3001);
  const hostname = options.hostname ?? "127.0.0.1";
  const securityCtx = createSecurityContext(options.security);

  // Per-server session store (not module-level, so each server instance is isolated)
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  // Start periodic rate limit cleanup
  startRateLimitCleanup();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    logMcp("info", "http.request", {
      method: req.method,
      path: pathname,
      ip: req.socket.remoteAddress,
    });

    try {
      // --- CORS preflight (all paths) ---
      if (handleCorsPreflightIfNeeded(req, res, securityCtx.allowedOrigins)) {
        return;
      }

      // --- Health checks (skip origin/auth validation) ---
      if (pathname === "/healthz") {
        handleHealthz(req, res);
        return;
      }
      if (pathname === "/readyz") {
        handleReadyz(req, res, sessions);
        return;
      }

      // --- Security validation for /mcp ---
      if (pathname === "/mcp") {
        // Set CORS headers on all /mcp responses
        setCorsHeaders(res, req.headers.origin, securityCtx.allowedOrigins);

        const securityError = validateRequest(req, securityCtx);
        if (securityError) {
          const statusCode =
            securityError === "Rate limit exceeded" ? 429 :
            securityError === "Unauthorized" ? 401 :
            403;
          sendJsonError(res, statusCode, securityError);
          return;
        }

        await handleMcpRequest(req, res, sessions);
        return;
      }

      // --- 404 for everything else ---
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      logMcp("error", "http.unhandled_error", { error: message, path: pathname });
      if (!res.headersSent) {
        sendJsonError(res, 500, "Internal server error");
      }
    }
  });

  // --- Graceful shutdown ---------------------------------------------------

  const shutdown = async (signal: string) => {
    logMcp("info", "http.shutdown", { signal, sessions: sessions.size });

    // Close all active transports
    const closePromises: Promise<void>[] = [];
    for (const [sid, transport] of sessions) {
      logMcp("info", "http.session.closing", { sessionId: sid });
      closePromises.push(transport.close());
    }
    await Promise.allSettled(closePromises);
    sessions.clear();

    // Stop rate limit cleanup
    stopRateLimitCleanup();

    // Close the HTTP server
    server.close(() => {
      logMcp("info", "http.closed", { signal });
      process.exit(0);
    });

    // Force exit after 5 seconds if close hangs
    setTimeout(() => {
      logMcp("warn", "http.force_exit", { signal });
      process.exit(1);
    }, 5_000).unref();
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  // --- Start listening -----------------------------------------------------

  return new Promise<Server>((resolve, reject) => {
    server.on("error", (err) => {
      logMcp("error", "http.listen_error", { error: err.message, port, hostname });
      reject(err);
    });

    server.listen(port, hostname, () => {
      logMcp("info", "http.started", {
        port,
        hostname,
        url: `http://${hostname}:${port}/mcp`,
        healthz: `http://${hostname}:${port}/healthz`,
        readyz: `http://${hostname}:${port}/readyz`,
        authEnabled: !!securityCtx.authToken,
        rateLimitMax: securityCtx.rateLimitMax,
      });
      resolve(server);
    });
  });
}
