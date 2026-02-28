import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createSecurityContext,
  validateRequest,
  setCorsHeaders,
  handleCorsPreflightIfNeeded,
  sendJsonError,
  parseJsonBody,
  startRateLimitCleanup,
  stopRateLimitCleanup,
  type HttpSecurityContext,
} from "../src/http-security.js";

// ---------------------------------------------------------------------------
// Helpers: create mock IncomingMessage / ServerResponse
// ---------------------------------------------------------------------------

function mockRequest(overrides: {
  method?: string;
  headers?: Record<string, string | string[]>;
  remoteAddress?: string;
  url?: string;
} = {}): IncomingMessage {
  return {
    method: overrides.method ?? "POST",
    url: overrides.url ?? "/mcp",
    headers: overrides.headers ?? {},
    socket: { remoteAddress: overrides.remoteAddress ?? "127.0.0.1" },
    on: () => {},
    destroy: () => {},
  } as unknown as IncomingMessage;
}

/** Collects writeHead / setHeader / end calls for assertions. */
function mockResponse(): ServerResponse & {
  _statusCode: number | undefined;
  _headers: Record<string, string>;
  _body: string;
  _ended: boolean;
} {
  const res = {
    _statusCode: undefined as number | undefined,
    _headers: {} as Record<string, string>,
    _body: "",
    _ended: false,
    headersSent: false,
    writeHead(code: number, headers?: Record<string, string>) {
      res._statusCode = code;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name.toLowerCase()] = value;
      return res;
    },
    end(body?: string) {
      if (body) res._body = body;
      res._ended = true;
      res.headersSent = true;
    },
  };
  return res as unknown as ServerResponse & typeof res;
}

// ---------------------------------------------------------------------------
// createSecurityContext
// ---------------------------------------------------------------------------

describe("createSecurityContext", () => {
  const originalEnv = process.env.MCP_AUTH_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MCP_AUTH_TOKEN;
    } else {
      process.env.MCP_AUTH_TOKEN = originalEnv;
    }
  });

  it("returns defaults when no options provided", () => {
    delete process.env.MCP_AUTH_TOKEN;
    const ctx = createSecurityContext();
    expect(ctx.allowedOrigins).toContain("http://localhost");
    expect(ctx.allowedOrigins).toContain("http://127.0.0.1");
    expect(ctx.allowedHosts).toContain("localhost");
    expect(ctx.allowedHosts).toContain("127.0.0.1");
    expect(ctx.authToken).toBeUndefined();
    expect(ctx.rateLimitMax).toBe(100);
    expect(ctx.rateLimitWindowMs).toBe(60_000);
    expect(ctx.strictOriginCheck).toBe(true);
  });

  it("reads MCP_AUTH_TOKEN from env", () => {
    process.env.MCP_AUTH_TOKEN = "test-token-123";
    const ctx = createSecurityContext();
    expect(ctx.authToken).toBe("test-token-123");
  });

  it("explicit authToken overrides env var", () => {
    process.env.MCP_AUTH_TOKEN = "env-token";
    const ctx = createSecurityContext({ authToken: "explicit-token" });
    expect(ctx.authToken).toBe("explicit-token");
  });

  it("accepts custom origins and hosts", () => {
    const ctx = createSecurityContext({
      allowedOrigins: ["https://custom.example.com"],
      allowedHosts: ["custom.example.com"],
    });
    expect(ctx.allowedOrigins).toEqual(["https://custom.example.com"]);
    expect(ctx.allowedHosts).toEqual(["custom.example.com"]);
  });

  it("accepts custom rate limits", () => {
    const ctx = createSecurityContext({
      rateLimitMax: 50,
      rateLimitWindowMs: 30_000,
    });
    expect(ctx.rateLimitMax).toBe(50);
    expect(ctx.rateLimitWindowMs).toBe(30_000);
  });

  it("strictOriginCheck can be disabled", () => {
    const ctx = createSecurityContext({ strictOriginCheck: false });
    expect(ctx.strictOriginCheck).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateRequest
// ---------------------------------------------------------------------------

describe("validateRequest", () => {
  let ctx: HttpSecurityContext;

  beforeEach(() => {
    stopRateLimitCleanup(); // Reset rate limit state between tests
    ctx = createSecurityContext({
      rateLimitMax: 5,
      rateLimitWindowMs: 60_000,
    });
  });

  afterEach(() => {
    stopRateLimitCleanup();
  });

  it("passes valid request with correct host", () => {
    const req = mockRequest({
      headers: { host: "localhost:3001" },
    });
    expect(validateRequest(req, ctx)).toBeUndefined();
  });

  it("passes request with 127.0.0.1 host", () => {
    const req = mockRequest({
      headers: { host: "127.0.0.1:3001" },
    });
    expect(validateRequest(req, ctx)).toBeUndefined();
  });

  it("rejects request with invalid host header", () => {
    const req = mockRequest({
      headers: { host: "evil.example.com" },
    });
    expect(validateRequest(req, ctx)).toBe("Invalid Host header");
  });

  it("rejects request with no host header", () => {
    const req = mockRequest({
      headers: {},
    });
    // Rate limit passes, auth not configured, but host check fails
    expect(validateRequest(req, ctx)).toBe("Invalid Host header");
  });

  it("enforces rate limiting", () => {
    const makeReq = () => mockRequest({
      headers: { host: "localhost:3001" },
      remoteAddress: "10.0.0.1",
    });

    // First 5 requests should pass
    for (let i = 0; i < 5; i++) {
      expect(validateRequest(makeReq(), ctx)).toBeUndefined();
    }

    // 6th request should be rate limited
    expect(validateRequest(makeReq(), ctx)).toBe("Rate limit exceeded");
  });

  it("enforces bearer token auth when configured", () => {
    const authCtx = createSecurityContext({
      authToken: "my-secret-token",
      rateLimitMax: 100,
    });

    // No auth header
    const req1 = mockRequest({
      headers: { host: "localhost:3001" },
    });
    expect(validateRequest(req1, authCtx)).toBe("Unauthorized");

    // Wrong token
    const req2 = mockRequest({
      headers: { host: "localhost:3001", authorization: "Bearer wrong-token" },
    });
    expect(validateRequest(req2, authCtx)).toBe("Unauthorized");

    // Correct token
    const req3 = mockRequest({
      headers: { host: "localhost:3001", authorization: "Bearer my-secret-token" },
    });
    expect(validateRequest(req3, authCtx)).toBeUndefined();
  });

  it("rejects invalid origin when strict origin check is enabled", () => {
    const req = mockRequest({
      headers: {
        host: "localhost:3001",
        origin: "https://evil.example.com",
      },
    });
    expect(validateRequest(req, ctx)).toBe("Invalid Origin header");
  });

  it("allows request without origin header (no browser)", () => {
    // Non-browser clients (like curl) don't send Origin
    const req = mockRequest({
      headers: { host: "localhost:3001" },
    });
    expect(validateRequest(req, ctx)).toBeUndefined();
  });

  it("allows matching origin with port variant", () => {
    const req = mockRequest({
      headers: {
        host: "localhost:3001",
        origin: "http://localhost:5173",
      },
    });
    expect(validateRequest(req, ctx)).toBeUndefined();
  });

  it("skips origin check when skipOriginCheck is true", () => {
    const req = mockRequest({
      headers: {
        host: "localhost:3001",
        origin: "https://evil.example.com",
      },
    });
    expect(validateRequest(req, ctx, true)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setCorsHeaders
// ---------------------------------------------------------------------------

describe("setCorsHeaders", () => {
  it("sets CORS headers with matching origin", () => {
    const res = mockResponse();
    const allowed = ["http://localhost", "http://127.0.0.1"];
    setCorsHeaders(res, "http://localhost:3000", allowed);

    expect(res._headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res._headers["access-control-allow-methods"]).toContain("POST");
    expect(res._headers["access-control-allow-headers"]).toContain("mcp-session-id");
    expect(res._headers["access-control-expose-headers"]).toContain("mcp-session-id");
    expect(res._headers["access-control-max-age"]).toBe("86400");
  });

  it("falls back to first allowed origin when origin doesn't match", () => {
    const res = mockResponse();
    const allowed = ["http://localhost", "http://127.0.0.1"];
    setCorsHeaders(res, "https://evil.example.com", allowed);

    expect(res._headers["access-control-allow-origin"]).toBe("http://localhost");
  });

  it("falls back to first allowed origin when no origin provided", () => {
    const res = mockResponse();
    const allowed = ["http://localhost"];
    setCorsHeaders(res, undefined, allowed);

    expect(res._headers["access-control-allow-origin"]).toBe("http://localhost");
  });

  it("exposes MCP-specific headers", () => {
    const res = mockResponse();
    setCorsHeaders(res, "http://localhost", ["http://localhost"]);

    const exposed = res._headers["access-control-expose-headers"];
    expect(exposed).toContain("mcp-session-id");
    expect(exposed).toContain("last-event-id");
    expect(exposed).toContain("mcp-protocol-version");
  });
});

// ---------------------------------------------------------------------------
// handleCorsPreflightIfNeeded
// ---------------------------------------------------------------------------

describe("handleCorsPreflightIfNeeded", () => {
  it("returns true and responds to OPTIONS request", () => {
    const req = mockRequest({ method: "OPTIONS", headers: { origin: "http://localhost" } });
    const res = mockResponse();
    const result = handleCorsPreflightIfNeeded(req, res, ["http://localhost"]);

    expect(result).toBe(true);
    expect(res._statusCode).toBe(204);
    expect(res._ended).toBe(true);
  });

  it("returns false for non-OPTIONS request", () => {
    const req = mockRequest({ method: "POST" });
    const res = mockResponse();
    const result = handleCorsPreflightIfNeeded(req, res, ["http://localhost"]);

    expect(result).toBe(false);
    expect(res._ended).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendJsonError
// ---------------------------------------------------------------------------

describe("sendJsonError", () => {
  it("sends plain JSON error without jsonrpc id", () => {
    const res = mockResponse();
    sendJsonError(res, 403, "Forbidden");

    expect(res._statusCode).toBe(403);
    expect(res._headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(res._body);
    expect(body.error).toBe("Forbidden");
  });

  it("sends JSON-RPC error with jsonrpc id", () => {
    const res = mockResponse();
    sendJsonError(res, 400, "Bad request", 42);

    expect(res._statusCode).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toBe("Bad request");
    expect(body.id).toBe(42);
  });

  it("sends JSON-RPC error with string id", () => {
    const res = mockResponse();
    sendJsonError(res, 500, "Internal error", "req-1");

    const body = JSON.parse(res._body);
    expect(body.id).toBe("req-1");
  });
});

// ---------------------------------------------------------------------------
// parseJsonBody
// ---------------------------------------------------------------------------

describe("parseJsonBody", () => {
  it("parses valid JSON body", async () => {
    const { req } = createReadableRequest(JSON.stringify({ method: "initialize" }));
    const result = await parseJsonBody(req);
    expect(result).toEqual({ method: "initialize" });
  });

  it("returns undefined for empty body", async () => {
    const { req } = createReadableRequest("");
    const result = await parseJsonBody(req);
    expect(result).toBeUndefined();
  });

  it("rejects invalid JSON", async () => {
    const { req } = createReadableRequest("not json{{{");
    await expect(parseJsonBody(req)).rejects.toThrow("Invalid JSON");
  });

  it("rejects body exceeding 10MB", async () => {
    // Create a large body (>10MB)
    const largeBody = "x".repeat(10 * 1024 * 1024 + 1);
    const { req } = createReadableRequest(largeBody);
    await expect(parseJsonBody(req)).rejects.toThrow("Request body too large");
  });
});

/** Helper: creates a mock IncomingMessage that emits data/end events. */
function createReadableRequest(body: string): { req: IncomingMessage } {
  const { Readable } = require("node:stream");
  const readable = new Readable({
    read() {
      if (body.length > 0) {
        // Emit in chunks for realism
        const chunkSize = 64 * 1024;
        let offset = 0;
        while (offset < body.length) {
          this.push(Buffer.from(body.slice(offset, offset + chunkSize)));
          offset += chunkSize;
        }
      }
      this.push(null);
    },
  });

  // Attach minimal IncomingMessage-like properties
  readable.headers = {};
  readable.method = "POST";
  readable.url = "/mcp";
  readable.socket = { remoteAddress: "127.0.0.1" };

  return { req: readable as unknown as IncomingMessage };
}

// ---------------------------------------------------------------------------
// Rate limit cleanup lifecycle
// ---------------------------------------------------------------------------

describe("rateLimitCleanup", () => {
  afterEach(() => {
    stopRateLimitCleanup();
  });

  it("startRateLimitCleanup is idempotent", () => {
    // Should not throw when called multiple times
    startRateLimitCleanup();
    startRateLimitCleanup();
    stopRateLimitCleanup();
  });

  it("stopRateLimitCleanup is idempotent", () => {
    stopRateLimitCleanup();
    stopRateLimitCleanup();
  });
});
