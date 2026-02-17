import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

import { createAgentLintMcpServer } from "@/mcp/core/create-server";
import { logMcp } from "@/mcp/core/logger";
import { MCP_TOOL_NAMES } from "@/mcp/types";

import {
  createMcpAuthMiddleware,
  loadMcpAuthConfigFromEnv,
  type McpAuthConfig,
} from "./auth";
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  loadOAuthMetadataConfigFromEnv,
} from "./oauth-metadata";
import { McpSessionStore } from "./session-store";

export type McpHttpServerConfig = {
  host: string;
  port: number;
  statelessMode: boolean;
  maxBodyBytes: number;
  requestTimeoutMs: number;
  maxConcurrentRequests: number;
  sessionTtlMs: number;
  sessionSweepIntervalMs: number;
  allowedHosts?: string[];
  auth: McpAuthConfig;
};

export type RunningMcpHttpServer = {
  app: Express;
  config: McpHttpServerConfig;
  sessionStore: McpSessionStore;
  server: HttpServer;
  baseUrl: string;
  close: () => Promise<void>;
};

type McpHttpRequest = IncomingMessage & {
  auth?: AuthInfo;
};

function resolveAuthClientId(req: Request): string | null {
  const auth = (req as unknown as McpHttpRequest).auth;
  return auth?.clientId ?? null;
}

const MCP_PROMPT_NAMES = [
  "artifact_create_prompt",
  "artifact_review_prompt",
  "artifact_fix_prompt",
] as const;

const MCP_RESOURCE_TEMPLATES = [
  "agentlint://quality-metrics/{type}",
  "agentlint://prompt-pack/{type}",
  "agentlint://prompt-template/{type}",
  "agentlint://artifact-path-hints/{type}",
  "agentlint://artifact-spec/{type}",
  "agentlint://scoring-policy/{type}",
  "agentlint://assessment-schema/{type}",
  "agentlint://improvement-playbook/{type}",
] as const;

function resolveAdvertisedToolNamesForHttpTransport(): string[] {
  const workspaceScanEnabled = process.env.MCP_ENABLE_WORKSPACE_SCAN === "true";
  if (workspaceScanEnabled) {
    return [...MCP_TOOL_NAMES];
  }

  return MCP_TOOL_NAMES.filter((name) => name !== "analyze_workspace_artifacts");
}

function parseAllowedHosts(raw: string | undefined): string[] | undefined {
  if (!raw) {
    return undefined;
  }

  const hosts = raw
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return hosts.length > 0 ? hosts : undefined;
}

function parseSessionIdHeader(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    const [first] = value;
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }

  return null;
}

function getServerHostForLogs(configHost: string): string {
  return configHost === "0.0.0.0" ? "127.0.0.1" : configHost;
}

function resolveBaseUrlForMetadata(config: McpHttpServerConfig): string {
  const explicitBaseUrl = process.env.MCP_PUBLIC_BASE_URL;
  if (explicitBaseUrl && explicitBaseUrl.trim().length > 0) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  return `http://${getServerHostForLogs(config.host)}:${config.port}`;
}

export function loadMcpHttpConfigFromEnv(): McpHttpServerConfig {
  return {
    host: process.env.MCP_HTTP_HOST ?? "0.0.0.0",
    port: Number(process.env.MCP_HTTP_PORT ?? 3333),
    statelessMode: process.env.MCP_HTTP_STATELESS === "true",
    maxBodyBytes: Number(process.env.MCP_MAX_BODY_BYTES ?? 1_000_000),
    requestTimeoutMs: Number(process.env.MCP_REQUEST_TIMEOUT_MS ?? 30_000),
    maxConcurrentRequests: Number(process.env.MCP_MAX_CONCURRENT_REQUESTS ?? 64),
    sessionTtlMs: Number(process.env.MCP_SESSION_TTL_MS ?? 30 * 60_000),
    sessionSweepIntervalMs: Number(process.env.MCP_SESSION_SWEEP_INTERVAL_MS ?? 60_000),
    allowedHosts: parseAllowedHosts(process.env.MCP_ALLOWED_HOSTS),
    auth: loadMcpAuthConfigFromEnv(),
  };
}

function mergeConfig(
  base: McpHttpServerConfig,
  override: Partial<McpHttpServerConfig> | undefined,
): McpHttpServerConfig {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    auth: override.auth
      ? {
          ...base.auth,
          ...override.auth,
          tokens: override.auth.tokens ?? base.auth.tokens,
        }
      : base.auth,
  };
}

function withRequestTimeout(timeoutMs: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({ error: "MCP request timed out." });
      }
    });

    next();
  };
}

function installBodyErrorHandler(app: Express): void {
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (!error || typeof error !== "object") {
      return next(error);
    }

    const code = Reflect.get(error, "type");
    if (code === "entity.too.large") {
      return res.status(413).json({ error: "Request body too large." });
    }

    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: "Malformed JSON payload." });
    }

    return next(error);
  });
}

export function createMcpHttpApp(config: McpHttpServerConfig): {
  app: Express;
  sessionStore: McpSessionStore;
  close: () => Promise<void>;
} {
  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts,
  });
  const sessionStore = new McpSessionStore(config.sessionTtlMs);

  app.disable("x-powered-by");
  app.use(express.json({ limit: config.maxBodyBytes }));
  installBodyErrorHandler(app);

  const oauthMetadataConfig = loadOAuthMetadataConfigFromEnv(resolveBaseUrlForMetadata(config));

  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(buildProtectedResourceMetadata(oauthMetadataConfig));
  });

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    const metadata = buildAuthorizationServerMetadata(oauthMetadataConfig);
    if (!metadata) {
      return res.status(404).json({
        error:
          "OAuth authorization metadata is not configured. Set MCP_OAUTH_ISSUER, MCP_OAUTH_AUTHORIZATION_ENDPOINT, and MCP_OAUTH_TOKEN_ENDPOINT.",
      });
    }

    return res.json(metadata);
  });

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      uptimeSec: Math.round(process.uptime()),
      sessions: sessionStore.size(),
    });
  });

  app.get("/readyz", (_req, res) => {
    res.json({
      status: "ready",
      authRequired: config.auth.required,
      statelessMode: config.statelessMode,
      sessions: sessionStore.size(),
      capabilities: {
        tools: true,
        prompts: true,
        resources: true,
      },
      advertisedToolNames: resolveAdvertisedToolNamesForHttpTransport(),
      promptNames: MCP_PROMPT_NAMES,
      resourceTemplates: MCP_RESOURCE_TEMPLATES,
    });
  });

  app.use("/mcp", withRequestTimeout(config.requestTimeoutMs));
  app.use("/mcp", createMcpAuthMiddleware(config.auth));

  let activeRequests = 0;

  async function handleStatelessRequest(req: Request, res: Response): Promise<void> {
    const server = createAgentLintMcpServer({
      name: process.env.MCP_SERVER_NAME,
      version: process.env.MCP_SERVER_VERSION,
      transportMode: "http",
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req as McpHttpRequest, res, req.body);
    } finally {
      await Promise.allSettled([transport.close(), server.close()]);
    }
  }

  app.all("/mcp", async (req, res) => {
    const startedAt = Date.now();
    const sessionHeader = parseSessionIdHeader(req.headers["mcp-session-id"]);

    if (activeRequests >= config.maxConcurrentRequests) {
      return res.status(503).json({ error: "Server is busy. Retry shortly." });
    }

    activeRequests += 1;

    try {
      if (config.statelessMode) {
        await handleStatelessRequest(req, res);
        return;
      }

      if (sessionHeader) {
        const session = sessionStore.get(sessionHeader);
        if (!session) {
          return res.status(404).json({ error: "Unknown MCP session." });
        }

        const requestClientId = resolveAuthClientId(req);
        if (session.authClientId !== null && requestClientId !== session.authClientId) {
          return res.status(403).json({
            error: "MCP session is bound to a different authenticated client.",
          });
        }

        sessionStore.touch(sessionHeader);
        await session.transport.handleRequest(req as McpHttpRequest, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        return res.status(400).json({
          error: "Missing MCP session id. Initialize first or include Mcp-Session-Id header.",
        });
      }

      let initializedSessionId: string | null = null;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          initializedSessionId = sessionId;
        },
        onsessionclosed: (sessionId) => {
          void sessionStore.delete(sessionId);
        },
      });

      const server = createAgentLintMcpServer({
        name: process.env.MCP_SERVER_NAME,
        version: process.env.MCP_SERVER_VERSION,
        transportMode: "http",
      });
      await server.connect(transport);
      await transport.handleRequest(req as McpHttpRequest, res, req.body);

      if (initializedSessionId) {
        const requestClientId = resolveAuthClientId(req);
        sessionStore.set({
          sessionId: initializedSessionId,
          transport,
          server,
          authClientId: requestClientId,
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
        });
      } else {
        await Promise.allSettled([transport.close(), server.close()]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logMcp("error", "mcp.http.request.failed", {
        message,
        method: req.method,
        path: req.path,
        sessionId: sessionHeader,
      });

      if (!res.headersSent) {
        return res.status(500).json({ error: "MCP request failed." });
      }
    } finally {
      activeRequests -= 1;
      logMcp("info", "mcp.http.request", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        activeRequests,
        sessionId: sessionHeader,
      });
    }
  });

  const sweepTimer = setInterval(() => {
    void sessionStore.pruneExpired().then((pruned) => {
      if (pruned > 0) {
        logMcp("info", "mcp.http.sessions.pruned", { count: pruned });
      }
    });
  }, config.sessionSweepIntervalMs);
  sweepTimer.unref();

  return {
    app,
    sessionStore,
    close: async () => {
      clearInterval(sweepTimer);
      await sessionStore.closeAll();
    },
  };
}

export async function startMcpHttpServer(
  overrides?: Partial<McpHttpServerConfig>,
): Promise<RunningMcpHttpServer> {
  const config = mergeConfig(loadMcpHttpConfigFromEnv(), overrides);
  const { app, sessionStore, close: closeApp } = createMcpHttpApp(config);

  const server = await new Promise<HttpServer>((resolve, reject) => {
    const listeningServer = app.listen(config.port, config.host, () => {
      resolve(listeningServer);
    });
    listeningServer.on("error", reject);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  const baseUrl = `http://${getServerHostForLogs(config.host)}:${port}`;

  logMcp("info", "mcp.http.started", {
    host: config.host,
    port,
    statelessMode: config.statelessMode,
    authRequired: config.auth.required,
    allowedHosts: config.allowedHosts ?? [],
  });

  return {
    app,
    config,
    sessionStore,
    server,
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await closeApp();
    },
  };
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  void startMcpHttpServer().catch((error) => {
    logMcp("error", "mcp.http.fatal", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });
}
