import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { request as httpRequest } from "node:http";
import type { Server } from "node:http";
import { runHttpServer } from "../src/http.js";

// Increase max listeners to avoid warning in tests (many servers per process)
beforeAll(() => {
  process.setMaxListeners(30);
  return () => process.setMaxListeners(10);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a random port to avoid collisions between tests. */
function randomPort(): number {
  return 30000 + Math.floor(Math.random() * 10000);
}

/** Simple HTTP request helper that returns status, headers, and body. */
function fetchHttp(options: {
  port: number;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: options.port,
        path: options.path,
        method: options.method ?? "GET",
        headers: {
          host: "127.0.0.1",
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          let body = Buffer.concat(chunks).toString("utf-8");
          const flatHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") flatHeaders[key] = value;
            else if (Array.isArray(value)) flatHeaders[key] = value.join(", ");
          }

          // StreamableHTTPServerTransport may return SSE format.
          // Extract JSON from SSE 'data:' lines if the response is SSE.
          const contentType = flatHeaders["content-type"] ?? "";
          if (contentType.includes("text/event-stream") && body.includes("data: ")) {
            const dataLines = body
              .split("\n")
              .filter((l) => l.startsWith("data: "))
              .map((l) => l.slice(6));
            if (dataLines.length > 0) {
              body = dataLines.join("");
            }
          }

          resolve({ status: res.statusCode ?? 0, headers: flatHeaders, body });
        });
      },
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
    server = undefined;
  }
});

// ─── Server lifecycle ───

describe("HTTP server lifecycle", () => {
  it("starts and listens on specified port", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    expect(server).toBeDefined();
    expect(server.listening).toBe(true);
  });

  it("returns Server instance", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const address = server.address();
    expect(address).not.toBeNull();
    if (typeof address === "object" && address !== null) {
      expect(address.port).toBe(port);
    }
  });
});

// ─── Health checks ───

describe("health checks", () => {
  it("GET /healthz returns 200 with status ok", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const res = await fetchHttp({ port, path: "/healthz" });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
  });

  it("GET /readyz returns 200 with session count", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const res = await fetchHttp({ port, path: "/readyz" });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ready");
    expect(typeof body.sessions).toBe("number");
    expect(body.sessions).toBe(0);
  });
});

// ─── Routing ───

describe("routing", () => {
  it("returns 404 for unknown paths", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const res = await fetchHttp({ port, path: "/unknown" });
    expect(res.status).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Not found");
  });

  it("returns 405 for unsupported methods on /mcp", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "PUT",
      headers: { host: "127.0.0.1" },
    });
    expect(res.status).toBe(405);
  });

  it("handles CORS preflight on /mcp", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1",
        host: "127.0.0.1",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });
});

// ─── Security validation on /mcp ───

describe("/mcp security", () => {
  it("rejects /mcp with invalid host", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        host: "evil.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    expect(res.status).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("Invalid Host");
  });

  it("rejects /mcp with invalid origin", async () => {
    const port = randomPort();
    server = await runHttpServer({ port, hostname: "127.0.0.1" });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        host: "127.0.0.1",
        origin: "https://evil.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects /mcp with wrong auth token", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { authToken: "secret-123" },
    });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        host: "127.0.0.1",
        authorization: "Bearer wrong-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── MCP endpoint ───

describe("/mcp endpoint", () => {
  it("POST /mcp with invalid JSON returns 400", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        host: "127.0.0.1",
        "content-type": "application/json",
      },
      body: "not valid json{{{",
    });
    expect(res.status).toBe(400);
  });

  it("POST /mcp without session-id for non-init request returns 400", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    // Send a non-initialize request without mcp-session-id
    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        host: "127.0.0.1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("mcp-session-id");
  });

  it("GET /mcp without session-id returns 400", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "GET",
      headers: { host: "127.0.0.1" },
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /mcp without session-id returns 404", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "DELETE",
      headers: { host: "127.0.0.1" },
    });
    expect(res.status).toBe(404);
  });

  it("POST /mcp initialize creates a session", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    const res = await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        host: "127.0.0.1",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.1.0" },
        },
        id: 1,
      }),
    });

    expect(res.status).toBe(200);

    // Should have mcp-session-id in response headers
    expect(res.headers["mcp-session-id"]).toBeDefined();
    expect(typeof res.headers["mcp-session-id"]).toBe("string");
    expect(res.headers["mcp-session-id"]!.length).toBeGreaterThan(0);

    // Body should be valid JSON-RPC response
    const body = JSON.parse(res.body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(1);
    expect(body.result).toBeDefined();
    expect(body.result.protocolVersion).toBeDefined();
    expect(body.result.serverInfo).toBeDefined();
    expect(body.result.serverInfo.name).toBe("agentlint");
  });

  it("readyz reflects session count after initialization", async () => {
    const port = randomPort();
    server = await runHttpServer({
      port,
      hostname: "127.0.0.1",
      security: { strictOriginCheck: false },
    });

    // Before: 0 sessions
    const before = await fetchHttp({ port, path: "/readyz" });
    expect(JSON.parse(before.body).sessions).toBe(0);

    // Initialize a session
    await fetchHttp({
      port,
      path: "/mcp",
      method: "POST",
      headers: { host: "127.0.0.1", "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.1.0" },
        },
        id: 1,
      }),
    });

    // After: 1 session
    const after = await fetchHttp({ port, path: "/readyz" });
    expect(JSON.parse(after.body).sessions).toBe(1);
  });
});
