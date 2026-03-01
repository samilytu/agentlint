import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getGuidelinesInputSchema, type GetGuidelinesInput } from "@agent-lint/shared";
import { buildGuidelines } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";

export function registerGetGuidelinesTool(server: McpServer): void {
  server.registerTool(
    "agentlint_get_guidelines",
    {
      title: "Get Guidelines",
      description:
        "Returns comprehensive Markdown guidelines for creating or updating a context artifact (AGENTS.md, skills, rules, workflows, plans). " +
        "Includes mandatory sections, do/don't lists, anti-patterns, quality checklist, template skeleton, and client-specific hints. " +
        "Call this tool before creating or editing any AI agent context artifact file.",
      inputSchema: asInputSchema(getGuidelinesInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: GetGuidelinesInput) => {
      try {
        const markdown = buildGuidelines(args.type, args.client ?? "generic");
        return toMarkdownResult(markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`agentlint_get_guidelines failed: ${message}`);
      }
    }),
  );
}
