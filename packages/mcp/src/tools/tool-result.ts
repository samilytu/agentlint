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
