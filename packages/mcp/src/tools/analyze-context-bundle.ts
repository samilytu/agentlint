import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { buildPolicySnapshot } from "@agent-lint/shared";
import { analyzeArtifactMcpCore } from "@agent-lint/core";

import {
  analyzeContextBundleInputSchema,
  type AnalyzeContextBundleInput,
} from "@agent-lint/shared";
import { toToolResult } from "./tool-result.js";

const DEFAULT_PREVIEW_CHARS = 1_500;

export type AnalyzeContextBundleToolOutput = {
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
  resourceUris: {
    scoringPolicy: string;
    assessmentSchema: string;
    improvementPlaybook: string;
    artifactSpec: string;
    artifactPathHints: string;
  };
  score: number;
  warnings: string[];
  contextSummary: {
    provided: number;
    included: number;
    truncated: number;
    mergedChars: number;
  };
  mergedContentPreview?: string;
};

export async function executeAnalyzeContextBundleTool(
  input: AnalyzeContextBundleInput,
): Promise<AnalyzeContextBundleToolOutput> {
  const policySnapshot = buildPolicySnapshot(input.type);
  const analyzed = await analyzeArtifactMcpCore({
    type: input.type,
    content: input.content,
    contextDocuments: input.contextDocuments,
    analysisEnabled: input.analysisEnabled,
  });

  return {
    policySnapshot,
    resourceUris: {
      scoringPolicy: `agentlint://scoring-policy/${input.type}`,
      assessmentSchema: `agentlint://assessment-schema/${input.type}`,
      improvementPlaybook: `agentlint://improvement-playbook/${input.type}`,
      artifactSpec: `agentlint://artifact-spec/${input.type}`,
      artifactPathHints: `agentlint://artifact-path-hints/${input.type}`,
    },
    score: analyzed.result.score,
    warnings: analyzed.warnings,
    contextSummary: analyzed.contextSummary,
    mergedContentPreview: input.includeMergedContentPreview
      ? analyzed.mergedContent.slice(0, DEFAULT_PREVIEW_CHARS)
      : undefined,
  };
}

export function registerAnalyzeContextBundleTool(server: McpServer): void {
  server.registerTool(
    "analyze_context_bundle",
    {
      title: "Analyze Context Bundle",
      description:
        "Advisory merged-context diagnostics (for example AGENTS + rules + roadmap). Returns policy snapshot and resource URIs so client LLM can continue with submit_client_assessment and quality_gate_artifact.",
      inputSchema: analyzeContextBundleInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const output = await executeAnalyzeContextBundleTool(args);

        return toToolResult({
          summary: `score=${output.score} context=${output.contextSummary.included}/${output.contextSummary.provided} warnings=${output.warnings.length}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `analyze_context_bundle failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    },
  );
}
