import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolConfig = Parameters<McpServer["registerTool"]>[1];
type ToolHandler = Parameters<McpServer["registerTool"]>[2];

export type CompatibleInputSchema = NonNullable<ToolConfig["inputSchema"]>;

export function asInputSchema<T>(schema: T): CompatibleInputSchema {
  return schema as unknown as CompatibleInputSchema;
}

export function asToolHandler<T>(handler: T): ToolHandler {
  return handler as unknown as ToolHandler;
}
