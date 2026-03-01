import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { quickCheckInputSchema, type QuickCheckInput } from "@agent-lint/shared";
import { runQuickCheck } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";

export function registerQuickCheckTool(server: McpServer): void {
  server.registerTool(
    "agentlint_quick_check",
    {
      title: "Quick Check",
      description:
        "Checks whether recent code changes require updates to AI agent context artifacts. " +
        "Provide changed file paths and/or a description of what changed. " +
        "Returns signals indicating which artifacts (AGENTS.md, rules, workflows, etc.) may need updating and what action to take. " +
        "Call this after structural changes like adding modules, changing configs, or modifying dependencies.",
      inputSchema: asInputSchema(quickCheckInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: QuickCheckInput) => {
      try {
        const result = runQuickCheck(args.changedPaths, args.changeDescription);
        return toMarkdownResult(result.markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`agentlint_quick_check failed: ${message}`);
      }
    }),
  );
}
