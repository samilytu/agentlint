import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Request, RequestHandler } from "express";

import { checkRateLimit } from "@/server/security/rate-limit";

import { MCP_TOOL_SCOPE_REQUIREMENTS } from "../types";

export type McpBearerToken = {
  token: string;
  clientId: string;
  scopes: string[];
};

export type McpAuthConfig = {
  required: boolean;
  tokens: McpBearerToken[];
  maxRequests: number;
  windowMs: number;
  enforceToolScopes: boolean;
  trustProxyHeaders: boolean;
};

type McpAuthenticatedRequest = Request & {
  auth?: AuthInfo;
};

function splitScopes(value: string): string[] {
  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function parseBearerTokens(raw: string | undefined): McpBearerToken[] {
  if (!raw) {
    return [];
  }

  const entries = raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const parsed: McpBearerToken[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index] ?? "";

    let clientId = `token-${index + 1}`;
    let tokenPart = entry;

    const equalsIndex = entry.indexOf("=");
    if (equalsIndex > 0) {
      clientId = entry.slice(0, equalsIndex).trim() || clientId;
      tokenPart = entry.slice(equalsIndex + 1).trim();
    }

    const colonIndex = tokenPart.indexOf(":");
    const token = (colonIndex >= 0 ? tokenPart.slice(0, colonIndex) : tokenPart).trim();
    const scopesRaw = colonIndex >= 0 ? tokenPart.slice(colonIndex + 1).trim() : "*";
    const scopes = splitScopes(scopesRaw);

    if (!token) {
      continue;
    }

    parsed.push({
      token,
      clientId,
      scopes: scopes.length > 0 ? scopes : ["*"],
    });
  }

  return parsed;
}

export function loadMcpAuthConfigFromEnv(): McpAuthConfig {
  const required = process.env.MCP_REQUIRE_AUTH !== "false";
  const tokens = parseBearerTokens(process.env.MCP_BEARER_TOKENS);
  const maxRequests = Number(process.env.MCP_RATE_LIMIT_MAX_REQUESTS ?? 120);
  const windowMs = Number(process.env.MCP_RATE_LIMIT_WINDOW_MS ?? 60_000);
  const enforceToolScopes = process.env.MCP_ENFORCE_TOOL_SCOPES !== "false";
  const trustProxyHeaders = process.env.MCP_TRUST_PROXY === "true";

  if (required && tokens.length === 0) {
    throw new Error(
      "MCP auth is required but MCP_BEARER_TOKENS is empty. Configure at least one bearer token.",
    );
  }

  return {
    required,
    tokens,
    maxRequests,
    windowMs,
    enforceToolScopes,
    trustProxyHeaders,
  };
}

function parseBearerTokenHeader(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  const [scheme, token] = raw.split(/\s+/, 2);
  if (!scheme || !token) {
    return null;
  }

  return scheme.toLowerCase() === "bearer" ? token.trim() : null;
}

function hasRequiredScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes("*") || scopes.includes(requiredScope);
}

function requiredScopeForTool(toolName: string): string | null {
  if (Object.prototype.hasOwnProperty.call(MCP_TOOL_SCOPE_REQUIREMENTS, toolName)) {
    return MCP_TOOL_SCOPE_REQUIREMENTS[toolName as keyof typeof MCP_TOOL_SCOPE_REQUIREMENTS];
  }

  return null;
}

function extractToolCallNames(payload: unknown): string[] {
  const messages = Array.isArray(payload) ? payload : [payload];
  const names: string[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const method = Reflect.get(message, "method");
    if (method !== "tools/call") {
      continue;
    }

    const params = Reflect.get(message, "params");
    if (!params || typeof params !== "object") {
      continue;
    }

    const name = Reflect.get(params, "name");
    if (typeof name === "string" && name.trim().length > 0) {
      names.push(name.trim());
    }
  }

  return names;
}

function getIpAddress(req: Request, trustProxyHeaders: boolean): string {
  if (!trustProxyHeaders) {
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    const [first] = forwardedFor.split(",");
    return first?.trim() || "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const [firstHeaderValue] = forwardedFor;
    if (typeof firstHeaderValue === "string" && firstHeaderValue.length > 0) {
      const [first] = firstHeaderValue.split(",");
      return first?.trim() || "unknown";
    }
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createMcpAuthMiddleware(config: McpAuthConfig): RequestHandler {
  const tokenMap = new Map(config.tokens.map((token) => [token.token, token]));

  return (req, res, next) => {
    const tokenFromHeader = parseBearerTokenHeader(req.header("authorization") ?? undefined);

    if (!config.required && !tokenFromHeader) {
      return next();
    }

    if (!tokenFromHeader) {
      return res.status(401).json({ error: "Missing Bearer token." });
    }

    const tokenRecord = tokenMap.get(tokenFromHeader);
    if (!tokenRecord) {
      return res.status(401).json({ error: "Invalid Bearer token." });
    }

    const authInfo: AuthInfo = {
      token: tokenRecord.token,
      clientId: tokenRecord.clientId,
      scopes: tokenRecord.scopes,
    };

    (req as McpAuthenticatedRequest).auth = authInfo;

    const rateLimit = checkRateLimit(
      `mcp:${tokenRecord.clientId}:${getIpAddress(req, config.trustProxyHeaders)}`,
      config.maxRequests,
      config.windowMs,
    );
    res.setHeader("x-ratelimit-limit", String(config.maxRequests));
    res.setHeader("x-ratelimit-remaining", String(rateLimit.remaining));

    if (!rateLimit.allowed) {
      res.setHeader("retry-after", String(Math.ceil(rateLimit.retryAfterMs / 1000)));
      return res.status(429).json({
        error: `Rate limit exceeded. Retry in ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`,
      });
    }

    if (config.enforceToolScopes) {
      const toolNames = extractToolCallNames(req.body);
      for (const toolName of toolNames) {
        const requiredScope = requiredScopeForTool(toolName);
        if (!requiredScope) {
          continue;
        }

        if (!hasRequiredScope(tokenRecord.scopes, requiredScope)) {
          return res.status(403).json({
            error: `Token scope does not allow tool '${toolName}'. Required scope: '${requiredScope}'.`,
          });
        }
      }
    }

    return next();
  };
}
