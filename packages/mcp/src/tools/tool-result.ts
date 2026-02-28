import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toToolResult(input: {
  summary: string;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
}): CallToolResult {
  return {
    isError: input.isError ?? false,
    content: [
      {
        type: "text",
        text: input.summary,
      },
    ],
    structuredContent: input.structuredContent,
  };
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolTimeoutError, withToolTimeout } from "../transport-security.js";

/**
 * Wraps an McpServer so that every tool registered through it automatically
 * gets a timeout guard. The timeout is looked up by tool name from TOOL_TIMEOUTS.
 *
 * The underlying McpServer is NOT modified; a Proxy is returned.
 */
export function withTimeoutGuard(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "registerTool") {
        return function registerToolWithTimeout(
          name: string,
          config: Parameters<McpServer["registerTool"]>[1],
          handler: (...args: unknown[]) => Promise<CallToolResult>,
        ) {
          const wrappedHandler = async (...args: unknown[]): Promise<CallToolResult> => {
            try {
              return await withToolTimeout(name, () => handler(...args));
            } catch (error) {
              if (error instanceof ToolTimeoutError) {
                return toToolResult({
                  summary: `${name} timed out after ${error.timeoutMs}ms`,
                  structuredContent: { error: error.message, timeoutMs: error.timeoutMs },
                  isError: true,
                });
              }
              throw error;
            }
          };
          return target.registerTool(name, config, wrappedHandler as Parameters<McpServer["registerTool"]>[2]);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
