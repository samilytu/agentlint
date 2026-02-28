import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolConfig = Parameters<McpServer["registerTool"]>[1];
type ToolHandler = Parameters<McpServer["registerTool"]>[2];

type PromptConfig = Parameters<McpServer["registerPrompt"]>[1];
type PromptHandler = Parameters<McpServer["registerPrompt"]>[2];

export type CompatibleInputSchema = NonNullable<ToolConfig["inputSchema"]>;
export type CompatiblePromptArgsSchema = NonNullable<PromptConfig["argsSchema"]>;

export function asInputSchema<T>(schema: T): CompatibleInputSchema {
  return schema as unknown as CompatibleInputSchema;
}

export function asToolHandler<T>(handler: T): ToolHandler {
  return handler as unknown as ToolHandler;
}

export function asPromptArgsSchema<T>(schema: T): CompatiblePromptArgsSchema {
  return schema as unknown as CompatiblePromptArgsSchema;
}

export function asPromptHandler<T>(handler: T): PromptHandler {
  return handler as unknown as PromptHandler;
}
