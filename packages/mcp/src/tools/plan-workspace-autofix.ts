import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { planWorkspaceAutofixInputSchema, type PlanWorkspaceAutofixInput } from "@agent-lint/shared";
import { buildWorkspaceAutofixPlan } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";

export type RegisterPlanWorkspaceAutofixToolOptions = {
  enabled: boolean;
};

export function registerPlanWorkspaceAutofixTool(
  server: McpServer,
  options: RegisterPlanWorkspaceAutofixToolOptions,
): void {
  if (!options.enabled) {
    return;
  }

  server.registerTool(
    "agentlint_plan_workspace_autofix",
    {
      title: "Plan Workspace Autofix",
      description:
        "Scans the workspace for all AI agent context artifact files (AGENTS.md, CLAUDE.md, skills, rules, workflows, plans), " +
        "identifies missing files and incomplete sections, and returns a step-by-step Markdown action plan. " +
        "The LLM should execute the plan using its file reading and editing capabilities. " +
        "Call this when the user asks to review, fix, or improve all context artifacts in a project.",
      inputSchema: asInputSchema(planWorkspaceAutofixInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: PlanWorkspaceAutofixInput) => {
      try {
        const rootPath = args.rootPath ?? process.cwd();
        const plan = buildWorkspaceAutofixPlan(rootPath);
        return toMarkdownResult(plan.markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`agentlint_plan_workspace_autofix failed: ${message}`);
      }
    }),
  );
}
