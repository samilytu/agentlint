import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAgentLintMcpServer } from "./server.js";
import { logMcp } from "./logger.js";
import { applyMessageSizeGuard } from "./transport-security.js";
export async function runStdioServer(): Promise<void> {
  const server = createAgentLintMcpServer({
    name: process.env.MCP_SERVER_NAME,
    version: process.env.MCP_SERVER_VERSION,
    transportMode: "stdio",
  });

  const transport = applyMessageSizeGuard(new StdioServerTransport());
  await server.connect(transport);

  logMcp("info", "mcp.stdio.started", {
    name: process.env.MCP_SERVER_NAME ?? "agentlint-mcp",
  });

  const shutdown = async (signal: string) => {
    logMcp("info", "mcp.stdio.shutdown", { signal });
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
