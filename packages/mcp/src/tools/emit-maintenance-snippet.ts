import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { emitMaintenanceSnippetInputSchema, type EmitMaintenanceSnippetInput } from "@agent-lint/shared";
import { buildMaintenanceSnippet } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";

export function registerEmitMaintenanceSnippetTool(server: McpServer): void {
  server.registerTool(
    "agentlint_emit_maintenance_snippet",
    {
      title: "Emit Maintenance Snippet",
      description:
        "Returns a persistent rule snippet that you should add to the user's IDE rules file. " +
        "Once added, these rules ensure the LLM agent automatically maintains context artifacts " +
        "(AGENTS.md, skills, rules, workflows, plans) whenever structural changes happen. " +
        "Supports Cursor, Windsurf, VS Code, Claude Code, and generic formats. " +
        "Call this when the user asks to set up automatic context maintenance.",
      inputSchema: asInputSchema(emitMaintenanceSnippetInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: EmitMaintenanceSnippetInput) => {
      try {
        const result = buildMaintenanceSnippet(args.client ?? "generic");
        return toMarkdownResult(result.markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`agentlint_emit_maintenance_snippet failed: ${message}`);
      }
    }),
  );
}
