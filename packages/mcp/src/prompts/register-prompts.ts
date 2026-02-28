import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  analyzeArtifactInputSchema,
  artifactTypeSchema,
  clientAssessmentSchema,
  clientMetricEvidenceSchema,
  type ArtifactType,
} from "@agent-lint/shared";
import { getPromptPack, judgeSystemPrompts } from "@agent-lint/core";
import { asPromptArgsSchema, asPromptHandler } from "../tools/schema-compat.js";

export function registerAgentLintPrompts(server: McpServer): void {
  server.registerPrompt(
    "artifact_create_prompt",
    {
      title: "Artifact Create Prompt",
      description:
        "Guided prompt to create AGENTS/skills/rules/workflows/plans content with Agent Lint quality criteria.",
      argsSchema: asPromptArgsSchema({
        type: artifactTypeSchema,
        projectContext: clientMetricEvidenceSchema.shape.summary.describe(
          "Optional project context summary (stack, constraints, architecture).",
        ),
      }),
    },
    asPromptHandler(({ type, projectContext }: { type: ArtifactType; projectContext?: string }) => {
      const pack = getPromptPack(type);
      const rubric = judgeSystemPrompts[type];

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Create a ${type} artifact for this repository.`,
                projectContext ? `Project context: ${projectContext}` : "",
                "",
                `Prompt pack title: ${pack.title}`,
                `Prompt pack summary: ${pack.summary}`,
                "",
                "Prompt pack body:",
                pack.prompt,
                "",
                "Judge rubric:",
                rubric,
                "",
                "Use concise, actionable content and include explicit verification and safety gates.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          },
        ],
      };
    }),
  );

  server.registerPrompt(
    "artifact_review_prompt",
    {
      title: "Artifact Review Prompt",
      description:
        "Prompt for reviewing existing artifact content and enforcing Agent Lint quality standards.",
      argsSchema: asPromptArgsSchema({
        type: artifactTypeSchema,
        content: analyzeArtifactInputSchema.shape.content,
      }),
    },
    asPromptHandler(({ type, content }: { type: ArtifactType; content: string }) => {
      const rubric = judgeSystemPrompts[type];

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Review this ${type} artifact for quality and safety.`,
                "If MCP tools are available, prefer this order:",
                "1) prepare_artifact_fix_context",
                "2) Read resources: scoring-policy, assessment-schema, artifact-spec, artifact-path-hints",
                "3) Scan repository and build metric evidence for all scoring metrics",
                "4) submit_client_assessment",
                "5) quality_gate_artifact (with candidateContent + clientAssessment)",
                "6) validate_export before final response",
                "",
                "Review rubric:",
                rubric,
                "",
                "Artifact content:",
                content,
              ].join("\n"),
            },
          },
        ],
      };
    }),
  );

  server.registerPrompt(
    "artifact_fix_prompt",
    {
      title: "Artifact Fix Prompt",
      description:
        "Prompt for fixing low-scoring artifact content using Agent Lint quality metrics and patch flow.",
      argsSchema: asPromptArgsSchema({
        type: artifactTypeSchema,
        originalContent: analyzeArtifactInputSchema.shape.content,
        score: clientAssessmentSchema.shape.confidence,
        warnings: clientAssessmentSchema.shape.gaps,
      }),
    },
    asPromptHandler(({
      type,
      originalContent,
      score,
      warnings,
    }: {
      type: ArtifactType;
      originalContent: string;
      score?: number;
      warnings?: string[];
    }) => {
      const rubric = judgeSystemPrompts[type];
      const warningBlock =
        warnings && warnings.length > 0
          ? warnings.map((item: string) => `- ${item}`).join("\n")
          : "- none";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Improve this ${type} artifact to meet quality requirements.`,
                typeof score === "number"
                  ? `Current score: ${score}`
                  : "Current score: unknown",
                "Warnings:",
                warningBlock,
                "",
                "Repair flow:",
                "1) Call prepare_artifact_fix_context for policy weights, required flow, and assessment template.",
                "2) Read scoring-policy and assessment-schema resources for this artifact type.",
                "3) Build evidence-backed client metric scores (all metrics) and call submit_client_assessment.",
                "4) Revise content in your editor/client LLM; pass candidateContent + clientAssessment to quality_gate_artifact.",
                "5) Use suggest_patch when fine-grained segment selection is needed.",
                "6) Run validate_export before returning final content.",
                "",
                "Quality rubric:",
                rubric,
                "",
                "Original content:",
                originalContent,
              ].join("\n"),
            },
          },
        ],
      };
    }),
  );
}
