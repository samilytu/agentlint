import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { scoreArtifactInputSchema, type ScoreArtifactInput } from "@agent-lint/shared";
import { scoreArtifact } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toMarkdownResult, toErrorResult } from "./tool-result.js";
import { withToolTimeout } from "../transport-security.js";

export function registerScoreArtifactTool(server: McpServer): void {
  const toolName = "agentlint_score_artifact";

  server.registerTool(
    toolName,
    {
      title: "Score Artifact",
      description:
        "Scores an AI agent context artifact (AGENTS.md, CLAUDE.md, skill, rule, workflow, plan) " +
        "against AgentLint's 12 quality dimensions: clarity, specificity, scope-control, completeness, " +
        "actionability, verifiability, safety, injection-resistance, secret-hygiene, token-efficiency, " +
        "platform-fit, and maintainability. " +
        "Returns a 0–100 overall score with per-dimension breakdowns and targeted improvement suggestions. " +
        "Use this in an autoresearch loop: score → improve → score again → compare → keep or revert. " +
        "Section aliases are accepted — strict heading names are not required.",
      inputSchema: asInputSchema(scoreArtifactInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: ScoreArtifactInput) => {
      try {
        const result = await withToolTimeout(toolName, async () =>
          scoreArtifact(args.content, args.type));
        return toMarkdownResult(result.markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toErrorResult(`${toolName} failed: ${message}`);
      }
    }),
  );
}
