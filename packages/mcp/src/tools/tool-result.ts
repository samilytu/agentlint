import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toMarkdownResult(markdown: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: markdown,
      },
    ],
  };
}

export function toErrorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Error: ${message}`,
      },
    ],
  };
}
