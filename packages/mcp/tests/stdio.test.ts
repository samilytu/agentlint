import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type JsonRpcId = number;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: Record<string, unknown>;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

function isResponseWithId(message: unknown, id: JsonRpcId): message is JsonRpcResponse {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as { id?: unknown };
  return candidate.id === id;
}

class McpStdioClient {
  private readonly server: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<JsonRpcId, (response: JsonRpcResponse) => void>();
  private nextId = 1;
  private readBuffer = Buffer.alloc(0);

  constructor(server: ChildProcessWithoutNullStreams) {
    this.server = server;
    this.server.stdout.on("data", (chunk: Buffer) => {
      this.onData(chunk);
    });
  }

  async request(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = this.nextId;
    this.nextId += 1;

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const responsePromise = new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for JSON-RPC response for ${method}`));
      }, 15_000);

      this.pending.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    this.send(request);
    return responsePromise;
  }

  notify(method: string, params?: Record<string, unknown>): void {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    this.send(notification);
  }

  private send(message: JsonRpcRequest | JsonRpcNotification): void {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, "utf8");
    this.server.stdin.write(Buffer.concat([header, body]));
  }

  private onData(chunk: Buffer): void {
    this.readBuffer = Buffer.concat([this.readBuffer, chunk]);

    while (true) {
      const headerEndIndex = this.readBuffer.indexOf("\r\n\r\n");
      if (headerEndIndex === -1) {
        return;
      }

      const header = this.readBuffer.slice(0, headerEndIndex).toString("utf8");
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
      if (!lengthMatch) {
        throw new Error("Missing Content-Length header in MCP stdio response");
      }

      const contentLength = Number(lengthMatch[1]);
      const messageStartIndex = headerEndIndex + 4;
      const messageEndIndex = messageStartIndex + contentLength;

      if (this.readBuffer.length < messageEndIndex) {
        return;
      }

      const payload = this.readBuffer.slice(messageStartIndex, messageEndIndex).toString("utf8");
      this.readBuffer = this.readBuffer.slice(messageEndIndex);

      const parsed: unknown = JSON.parse(payload);
      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      const id = (parsed as { id?: unknown }).id;
      if (typeof id !== "number") {
        continue;
      }

      const resolver = this.pending.get(id);
      if (!resolver) {
        continue;
      }

      if (isResponseWithId(parsed, id)) {
        this.pending.delete(id);
        resolver(parsed);
      }
    }
  }
}

function spawnMcpServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, ["--import", "tsx", "packages/mcp/src/bin.ts"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: {
      ...process.env,
      MCP_ENABLE_WORKSPACE_SCAN: "true",
    },
  });
}

const describeMcpStdio = process.platform === "win32" ? describe.skip : describe;

describeMcpStdio("MCP stdio server integration", { timeout: 30_000 }, () => {
  let server: ChildProcessWithoutNullStreams;
  let client: McpStdioClient;
  let stderrOutput = "";

  beforeAll(async () => {
    server = spawnMcpServer();
    client = new McpStdioClient(server);

    server.stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString("utf8");
    });

    server.on("error", (error) => {
      throw error;
    });

    const initializeResponse = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "vitest",
        version: "1.0.0",
      },
    });

    expect("result" in initializeResponse).toBe(true);
    if ("result" in initializeResponse) {
      expect(initializeResponse.result.capabilities).toBeTruthy();
      expect(initializeResponse.result.serverInfo).toBeTruthy();
    }

    client.notify("notifications/initialized", {});
  }, 30_000);

  afterAll(async () => {
    if (server.killed) {
      return;
    }

    server.kill("SIGTERM");
    await once(server, "exit");
  });

  it("lists all MCP tools", async () => {
    const response = await client.request("tools/list", {});
    expect("result" in response).toBe(true);

    if (!("result" in response)) {
      return;
    }

    const tools = response.result.tools;
    expect(Array.isArray(tools)).toBe(true);

    if (!Array.isArray(tools)) {
      return;
    }

    expect(tools).toHaveLength(9);

    const toolNames = tools
      .map((tool) => (typeof tool === "object" && tool !== null ? (tool as { name?: unknown }).name : null))
      .filter((name): name is string => typeof name === "string");

    expect(toolNames).toContain("analyze_artifact");
    expect(toolNames).toContain("quality_gate_artifact");
    expect(toolNames).toContain("analyze_workspace_artifacts");
    expect(toolNames).toContain("apply_patches");
  });

  it("calls analyze_artifact successfully", async () => {
    const response = await client.request("tools/call", {
      name: "analyze_artifact",
      arguments: {
        type: "agents",
        content: "# AGENTS\n\n## Mission\n- Be explicit and verifiable.",
      },
    });

    expect("result" in response).toBe(true);
    if (!("result" in response)) {
      return;
    }

    const structuredContent = response.result.structuredContent;
    expect(structuredContent).toBeTruthy();

    if (!structuredContent || typeof structuredContent !== "object") {
      return;
    }

    const score = (structuredContent as { score?: unknown }).score;
    const warnings = (structuredContent as { warnings?: unknown }).warnings;
    expect(typeof score).toBe("number");
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("returns an error for invalid tool calls", async () => {
    const response = await client.request("tools/call", {
      name: "tool_does_not_exist",
      arguments: {},
    });

    const isJsonRpcError = "error" in response;
    const isToolError = "result" in response && response.result.isError === true;

    expect(isJsonRpcError || isToolError).toBe(true);
  });

  it("lists registered prompts", async () => {
    const response = await client.request("prompts/list", {});
    expect("result" in response).toBe(true);

    if (!("result" in response)) {
      return;
    }

    const prompts = response.result.prompts;
    expect(Array.isArray(prompts)).toBe(true);

    if (!Array.isArray(prompts)) {
      return;
    }

    expect(prompts).toHaveLength(3);
  });

  it("does not log protocol data to stderr", () => {
    expect(stderrOutput).not.toContain("Content-Length");
  });
});
