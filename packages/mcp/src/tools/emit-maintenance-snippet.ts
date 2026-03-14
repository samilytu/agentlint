import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { emitMaintenanceSnippetInputSchema, type EmitMaintenanceSnippetInput } from "@agent-lint/shared";
import { buildMaintenanceSnippet } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";
import { withToolTimeout } from "../transport-security.js";

export function registerEmitMaintenanceSnippetTool(server: McpServer): void {
  const toolName = "agentlint_emit_maintenance_snippet";

  server.registerTool(
    toolName,
    {
      title: "Emit Maintenance Snippet",
      description:
        "Returns a persistent maintenance snippet that you should add to the user's managed client file or root context file. " +
        "Once added, these instructions help the LLM maintain context artifacts " +
        "(AGENTS.md, CLAUDE.md, rules, skills, workflows, plans) whenever structural changes happen. " +
        "Supports Cursor, Windsurf, VS Code, Claude Desktop, Claude Code, and generic formats. " +
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
        const result = await withToolTimeout(toolName, async () =>
          buildMaintenanceSnippet(args.client ?? "generic"));
        return toMarkdownResult(result.markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`${toolName} failed: ${message}`);
      }
    }),
  );
}
