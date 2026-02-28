import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { buildPolicySnapshot } from "@agent-lint/shared";
import { analyzeArtifactMcpCore } from "@agent-lint/core";

import { analyzeArtifactInputSchema, type AnalyzeArtifactInput } from "@agent-lint/shared";
import { toToolResult } from "./tool-result.js";

export type AnalyzeArtifactToolOutput = {
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
  requestedProvider: string;
  provider: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  confidence: number;
  warnings: string[];
  refinedContent: string;
  contextSummary: {
    provided: number;
    included: number;
    truncated: number;
    mergedChars: number;
  };
  advisory: {
    missingItems: {
      total: number;
      blocking: number;
      important: number;
      niceToHave: number;
    };
    signals: {
      critical: number;
      warning: number;
      info: number;
    };
    metricScores: Array<{
      id: string;
      score: number;
      status: string;
    }>;
  };
  analysisMode: "deterministic";
};

export async function executeAnalyzeArtifactTool(
  input: AnalyzeArtifactInput,
): Promise<AnalyzeArtifactToolOutput> {
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
    advisory: {
      missingItems: {
        total: analyzed.result.analysis.missingItems.length,
        blocking: analyzed.result.analysis.missingItems.filter((item) => item.severity === "blocking").length,
        important: analyzed.result.analysis.missingItems.filter((item) => item.severity === "important").length,
        niceToHave: analyzed.result.analysis.missingItems.filter((item) => item.severity === "nice_to_have")
          .length,
      },
      signals: {
        critical: analyzed.result.analysis.signals.filter((signal) => signal.severity === "critical").length,
        warning: analyzed.result.analysis.signals.filter((signal) => signal.severity === "warning").length,
        info: analyzed.result.analysis.signals.filter((signal) => signal.severity === "info").length,
      },
      metricScores: analyzed.result.analysis.metricExplanations.map((metric) => ({
        id: metric.id,
        score: metric.score,
        status: metric.status,
      })),
    },
    score: analyzed.result.score,
    requestedProvider: analyzed.requestedProvider,
    provider: analyzed.provider,
    fallbackUsed: analyzed.fallbackUsed,
    fallbackReason: analyzed.fallbackReason,
    confidence: analyzed.confidence,
    warnings: analyzed.warnings,
    refinedContent: analyzed.result.refinedContent,
    contextSummary: analyzed.contextSummary,
    analysisMode: analyzed.analysisMode,
  };
}

export function registerAnalyzeArtifactTool(server: McpServer): void {
  server.registerTool(
    "analyze_artifact",
    {
      title: "Analyze Artifact",
      description:
        "Advisory deterministic analysis for AGENTS.md/skills/rules/workflows/plans. Returns policy snapshot and resource URIs so client LLM always sees metric weights before rewrite. Not the primary scoring authority.",
      inputSchema: analyzeArtifactInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const output = await executeAnalyzeArtifactTool(args);
        const fallbackLabel = output.fallbackUsed
          ? ` fallback=${output.fallbackReason ?? "unknown"}`
          : "";

        return toToolResult({
          summary: `score=${output.score} provider=${output.provider}${fallbackLabel} warnings=${output.warnings.length}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `analyze_artifact failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    },
  );
}
