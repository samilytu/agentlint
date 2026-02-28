import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  CLIENT_LED_REQUIRED_FLOW,
  buildPolicySnapshot,
  clientMetricIds,
} from "@agent-lint/shared";
import {
  prepareArtifactFixContextInputSchema,
  type PrepareArtifactFixContextInput,
} from "@agent-lint/shared";

import { toToolResult } from "./tool-result.js";

const DEFAULT_TARGET_SCORE = 90;

export type PrepareArtifactFixContextToolOutput = {
  policySnapshot: {
    version: string;
    artifactType: string;
    defaultTargetScore: number;
    clientWeightPercent: number;
    guardrailWeightPercent: number;
    formula: string;
    metricWeights: Array<{
      metric: string;
      weightPercent: number;
      importance: string;
      guidance: string;
    }>;
    guardrailNotes: string[];
    hardFailConditions: string[];
  };
  targetScore: number;
  requiredFlow: string[];
  requiredToolOrder: string[];
  resourceUris: {
    scoringPolicy: string;
    assessmentSchema: string;
    improvementPlaybook: string;
    artifactSpec: string;
    artifactPathHints: string;
  };
  assessmentTemplate: {
    repositoryScanSummary: string;
    scannedPaths: string[];
    metricScores: Array<{
      metric: string;
      score: number;
    }>;
    metricEvidence: Array<{
      metric: string;
      citations: Array<{
        filePath: string;
        lineStart: number;
        snippet: string;
      }>;
    }>;
    weightedScore: number;
    confidence: number;
    gaps: string[];
    rewritePlan: string;
  };
  notes: string[];
};

export function executePrepareArtifactFixContextTool(
  input: PrepareArtifactFixContextInput,
): PrepareArtifactFixContextToolOutput {
  const policySnapshot = buildPolicySnapshot(input.type);
  const targetScore = input.targetScore ?? policySnapshot.defaultTargetScore ?? DEFAULT_TARGET_SCORE;

  const assessmentTemplate: PrepareArtifactFixContextToolOutput["assessmentTemplate"] = {
    repositoryScanSummary:
      "Summarize what was scanned in the repository before scoring (paths, docs, config files, conventions).",
    scannedPaths: ["AGENTS.md", "docs/", ".windsurf/rules/"],
    metricScores: clientMetricIds.map((metric) => ({
      metric,
      score: 0,
    })),
    metricEvidence: clientMetricIds.map((metric) => ({
      metric,
      citations: [
        {
          filePath: "path/to/file.md",
          lineStart: 1,
          snippet: `Evidence snippet for ${metric}`,
        },
      ],
    })),
    weightedScore: 0,
    confidence: 0,
    gaps: ["List top quality gaps before rewrite."],
    rewritePlan: "Explain how you will rewrite the artifact to raise weighted score.",
  };

  const notes = [
    "Client LLM is the primary scorer. Fill all metric scores and evidence before quality gate.",
    "For fix/update flows, call submit_client_assessment first and include the same assessment in quality_gate_artifact.",
    "Missing metric scores or evidence triggers hard-fail in the quality gate.",
  ];

  if (input.includeExamples === false) {
    assessmentTemplate.metricEvidence = [];
  }

  return {
    policySnapshot,
    targetScore,
    requiredFlow: [...CLIENT_LED_REQUIRED_FLOW],
    requiredToolOrder: [
      "prepare_artifact_fix_context",
      "submit_client_assessment",
      "quality_gate_artifact",
      "validate_export",
    ],
    resourceUris: {
      scoringPolicy: `agentlint://scoring-policy/${input.type}`,
      assessmentSchema: `agentlint://assessment-schema/${input.type}`,
      improvementPlaybook: `agentlint://improvement-playbook/${input.type}`,
      artifactSpec: `agentlint://artifact-spec/${input.type}`,
      artifactPathHints: `agentlint://artifact-path-hints/${input.type}`,
    },
    assessmentTemplate,
    notes,
  };
}

export function registerPrepareArtifactFixContextTool(server: McpServer): void {
  server.registerTool(
    "prepare_artifact_fix_context",
    {
      title: "Prepare Artifact Fix Context",
      description:
        "Run first when user asks to fix/improve AGENTS/skills/rules/workflows/plans. Returns policy weights, mandatory scoring flow, required resources, and assessment template so MCP client LLM always sees scoring constraints.",
      inputSchema: prepareArtifactFixContextInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const output = executePrepareArtifactFixContextTool(args);
        return toToolResult({
          summary: `prepared type=${args.type} target=${output.targetScore} metrics=${output.policySnapshot.metricWeights.length}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `prepare_artifact_fix_context failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    },
  );
}
