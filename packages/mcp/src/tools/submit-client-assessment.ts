import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  CLIENT_LED_REQUIRED_FLOW,
  getArtifactScoringPolicy,
} from "@agent-lint/shared";
import {
  submitClientAssessmentInputSchema,
  type SubmitClientAssessmentInput,
} from "@agent-lint/shared";

import { executeAnalyzeArtifactTool } from "./analyze-artifact.js";
import { evaluateClientAssessment } from "./client-assessment-evaluator.js";
import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toToolResult } from "./tool-result.js";
import { executeValidateExportTool } from "./validate-export.js";

export type SubmitClientAssessmentToolOutput = {
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
  policyVersion: string;
  requiredFlow: string[];
  resourceUris: {
    scoringPolicy: string;
    assessmentSchema: string;
    improvementPlaybook: string;
    artifactSpec: string;
    artifactPathHints: string;
  };
  passed: boolean;
  targetScore: number;
  clientWeightedScore: number;
  serverGuardrailScore: number;
  finalScore: number;
  scoreComposition: {
    clientWeightPercent: number;
    guardrailWeightPercent: number;
    clientContribution: number;
    guardrailContribution: number;
  };
  evidenceCoverage: {
    requiredMetrics: number;
    coveredScoreMetrics: number;
    coveredEvidenceMetrics: number;
    missingScoreMetrics: string[];
    missingEvidenceMetrics: string[];
  };
  consistency: {
    reportedWeightedScore: number | null;
    recomputedWeightedScore: number;
    delta: number;
    withinTolerance: boolean;
    duplicateScoreMetrics: string[];
    duplicateEvidenceMetrics: string[];
  };
  hardFailures: string[];
  warnings: string[];
  nextBestActions: string[];
  weightedGaps: Array<{
    metric: string;
    score: number;
    weightPercent: number;
    impact: number;
  }>;
  metricBreakdown: Array<{
    metric: string;
    score: number;
    weightPercent: number;
    weightedContribution: number;
    evidenceCount: number;
  }>;
  finalScoreBreakdown: {
    formula: string;
    clientWeightedScore: number;
    serverGuardrailScore: number;
    clientWeightPercent: number;
    guardrailWeightPercent: number;
    blendedClientContribution: number;
    blendedGuardrailContribution: number;
    finalScore: number;
  };
  serverAdvisory: {
    score: number;
    warnings: string[];
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
    };
  };
  exportValidation: {
    valid: boolean;
    reason: string | null;
  };
};

export async function executeSubmitClientAssessmentTool(
  input: SubmitClientAssessmentInput,
): Promise<SubmitClientAssessmentToolOutput> {
  const policy = getArtifactScoringPolicy(input.type);
  const targetScore = input.targetScore ?? policy.defaultTargetScore;

  const analysis = await executeAnalyzeArtifactTool({
    type: input.type,
    content: input.content,
    contextDocuments: input.contextDocuments,
    analysisEnabled: input.analysisEnabled,
  });

  const exportValidation = executeValidateExportTool({
    content: analysis.refinedContent,
  });

  const evaluation = evaluateClientAssessment({
    type: input.type,
    assessment: input.assessment,
    analysis,
    exportValidation,
    targetScore,
  });

  return {
    policySnapshot: evaluation.policySnapshot,
    policyVersion: evaluation.policyVersion,
    requiredFlow: [...CLIENT_LED_REQUIRED_FLOW],
    resourceUris: {
      scoringPolicy: `agentlint://scoring-policy/${input.type}`,
      assessmentSchema: `agentlint://assessment-schema/${input.type}`,
      improvementPlaybook: `agentlint://improvement-playbook/${input.type}`,
      artifactSpec: `agentlint://artifact-spec/${input.type}`,
      artifactPathHints: `agentlint://artifact-path-hints/${input.type}`,
    },
    passed: evaluation.passed,
    targetScore,
    clientWeightedScore: evaluation.clientWeightedScore,
    serverGuardrailScore: evaluation.serverGuardrailScore,
    finalScore: evaluation.finalScore,
    scoreComposition: evaluation.scoreComposition,
    evidenceCoverage: evaluation.evidenceCoverage,
    consistency: evaluation.consistency,
    hardFailures: evaluation.hardFailures,
    warnings: evaluation.warnings,
    nextBestActions: evaluation.nextBestActions,
    weightedGaps: evaluation.weightedGaps,
    metricBreakdown: evaluation.metricBreakdown,
    finalScoreBreakdown: evaluation.finalScoreBreakdown,
    serverAdvisory: {
      score: analysis.score,
      warnings: analysis.warnings,
      advisory: {
        missingItems: analysis.advisory.missingItems,
        signals: analysis.advisory.signals,
      },
    },
    exportValidation,
  };
}

export function registerSubmitClientAssessmentTool(server: McpServer): void {
  server.registerTool(
    "submit_client_assessment",
    {
      title: "Submit Client Assessment",
      description:
        "Primary and required client-led scoring entrypoint for artifact fixes. Submit weighted metric scores + evidence from the MCP client LLM; server recomputes weighted score, applies low-impact guardrail contribution, and returns directives plus full score breakdown.",
      inputSchema: asInputSchema(submitClientAssessmentInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: SubmitClientAssessmentInput) => {
      try {
        const output = await executeSubmitClientAssessmentTool(args);
        return toToolResult({
          summary: `passed=${output.passed} finalScore=${output.finalScore} client=${output.clientWeightedScore} guardrail=${output.serverGuardrailScore} hardFailures=${output.hardFailures.length}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `submit_client_assessment failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    }),
  );
}
