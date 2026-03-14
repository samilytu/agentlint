import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { quickCheckInputSchema, type QuickCheckInput } from "@agent-lint/shared";
import { runQuickCheck } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";
import { withToolTimeout } from "../transport-security.js";

export function registerQuickCheckTool(server: McpServer): void {
  const toolName = "agentlint_quick_check";

  server.registerTool(
    toolName,
    {
      title: "Quick Check",
      description:
        "Checks whether recent code changes require updates to AI agent context artifacts. " +
        "Provide changed file paths and/or a description of what changed. " +
        "Returns signals indicating which artifacts (AGENTS.md, CLAUDE.md, rules, skills, workflows, plans) may need updating and what action to take. " +
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
        const result = await withToolTimeout(toolName, async () =>
          runQuickCheck(args.changedPaths, args.changeDescription));
        return toMarkdownResult(result.markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`${toolName} failed: ${message}`);
      }
    }),
  );
}
