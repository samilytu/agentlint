import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  qualityGateArtifactInputSchema,
  type QualityGateArtifactInput,
} from "@agent-lint/shared";
import { CLIENT_LED_REQUIRED_FLOW, buildPolicySnapshot } from "@agent-lint/shared";

import { executeAnalyzeArtifactTool } from "./analyze-artifact.js";
import { evaluateClientAssessment } from "./client-assessment-evaluator.js";
import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { executeSuggestPatchTool } from "./suggest-patch.js";
import { toToolResult } from "./tool-result.js";
import { executeValidateExportTool } from "./validate-export.js";

const DEFAULT_TARGET_SCORE = 90;
const DEFAULT_REQUIRE_CLIENT_ASSESSMENT = true;

export type QualityGateArtifactToolOutput = {
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
  requiredFlow: string[];
  requireClientAssessment: boolean;
  enforcement: {
    clientAssessmentRequired: boolean;
    clientAssessmentProvided: boolean;
    violationCode: "CLIENT_ASSESSMENT_REQUIRED" | null;
  };
  targetScore: number;
  passed: boolean;
  initialScore: number;
  score: number;
  finalScore: number;
  scoreModel: "server_deterministic" | "client_weighted_hybrid";
  warnings: string[];
  hardFailures: string[];
  analysis: {
    provider: string;
    requestedProvider: string;
    fallbackUsed: boolean;
    fallbackReason: string | null;
    confidence: number;
    contextSummary: {
      provided: number;
      included: number;
      truncated: number;
      mergedChars: number;
    };
  };
  patch: {
    applied: boolean;
    segmentCount: number;
    selectedSegmentIndexes: number[];
    addedLines: number;
    removedLines: number;
  } | null;
  exportValidation: {
    valid: boolean;
    reason: string | null;
  };
  clientScoring: {
    policyVersion: string;
    clientWeightedScore: number;
    serverGuardrailScore: number;
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
  } | null;
  iteration: {
    iterationIndex: number;
    previousScore: number | null;
    currentScore: number;
    delta: number | null;
    remainingGaps: number;
  };
  nextBestActions: string[];
  finalContent: string;
};

export async function executeQualityGateArtifactTool(
  input: QualityGateArtifactInput,
): Promise<QualityGateArtifactToolOutput> {
  const targetScore = input.targetScore ?? DEFAULT_TARGET_SCORE;
  const requireClientAssessment = input.requireClientAssessment ?? DEFAULT_REQUIRE_CLIENT_ASSESSMENT;
  const applyPatchWhenBelowTarget = input.applyPatchWhenBelowTarget ?? true;
  const policySnapshot = buildPolicySnapshot(input.type);

  const initialAnalyzed = await executeAnalyzeArtifactTool({
    type: input.type,
    content: input.content,
    contextDocuments: input.contextDocuments,
    analysisEnabled: input.analysisEnabled,
  });

  let mergedContentCandidate = initialAnalyzed.refinedContent;
  let patch: QualityGateArtifactToolOutput["patch"] = null;

  if (
    applyPatchWhenBelowTarget &&
    initialAnalyzed.score < targetScore &&
    typeof input.candidateContent === "string" &&
    input.candidateContent.trim().length > 0
  ) {
    const suggested = executeSuggestPatchTool({
      originalContent: input.content,
      refinedContent: input.candidateContent,
      selectedSegmentIndexes: input.selectedSegmentIndexes,
    });

    mergedContentCandidate = suggested.suggestedContent;
    patch = {
      applied: true,
      segmentCount: suggested.segmentCount,
      selectedSegmentIndexes: suggested.selectedSegmentIndexes,
      addedLines: suggested.addedLines,
      removedLines: suggested.removedLines,
    };
  }

  const finalAnalyzed = patch
    ? await executeAnalyzeArtifactTool({
        type: input.type,
        content: mergedContentCandidate,
        contextDocuments: input.contextDocuments,
        analysisEnabled: input.analysisEnabled,
      })
    : initialAnalyzed;

  const finalContent = finalAnalyzed.refinedContent;

  const exportValidation = executeValidateExportTool({ content: finalContent });
  const iterationIndex = input.iterationIndex ?? 1;
  const previousScore =
    typeof input.previousFinalScore === "number" ? Math.round(input.previousFinalScore) : null;

  let scoreModel: QualityGateArtifactToolOutput["scoreModel"] = "server_deterministic";
  let finalScore = finalAnalyzed.score;
  let warnings = finalAnalyzed.warnings;
  let hardFailures: string[] = exportValidation.valid
    ? []
    : [`Export validation failed: ${exportValidation.reason ?? "unknown reason"}`];
  let passed = finalAnalyzed.score >= targetScore && exportValidation.valid;
  let nextBestActions = finalAnalyzed.warnings.slice(0, 3);
  let remainingGaps = finalAnalyzed.warnings.length;
  let clientScoring: QualityGateArtifactToolOutput["clientScoring"] = null;
  let requiredAssessmentFailure: string | null = null;
  let violationCode: QualityGateArtifactToolOutput["enforcement"]["violationCode"] = null;

  if (requireClientAssessment && !input.clientAssessment) {
    requiredAssessmentFailure =
      "clientAssessment is required for client-led scoring. Run prepare_artifact_fix_context and submit_client_assessment first.";
    violationCode = "CLIENT_ASSESSMENT_REQUIRED";
    passed = false;
    hardFailures = [...hardFailures, requiredAssessmentFailure];
    nextBestActions = [
      "Call prepare_artifact_fix_context for policy snapshot and assessment template.",
      "Compute metricScores + metricEvidence and call submit_client_assessment.",
      "Re-run quality_gate_artifact with clientAssessment and candidateContent.",
    ];
    remainingGaps = Math.max(remainingGaps, 1);
  } else if (input.clientAssessment) {
    const evaluation = evaluateClientAssessment({
      type: input.type,
      assessment: input.clientAssessment,
      analysis: finalAnalyzed,
      exportValidation,
      targetScore,
    });

    scoreModel = "client_weighted_hybrid";
    finalScore = evaluation.finalScore;
    warnings = [...finalAnalyzed.warnings, ...evaluation.warnings];
    hardFailures = evaluation.hardFailures;
    passed = evaluation.passed;
    nextBestActions = evaluation.nextBestActions;
    remainingGaps =
      evaluation.evidenceCoverage.missingScoreMetrics.length +
      evaluation.evidenceCoverage.missingEvidenceMetrics.length +
      evaluation.weightedGaps.filter((gap) => gap.score < targetScore).length;
    clientScoring = {
      policyVersion: evaluation.policyVersion,
      clientWeightedScore: evaluation.clientWeightedScore,
      serverGuardrailScore: evaluation.serverGuardrailScore,
      scoreComposition: evaluation.scoreComposition,
      evidenceCoverage: evaluation.evidenceCoverage,
      consistency: evaluation.consistency,
      weightedGaps: evaluation.weightedGaps,
      metricBreakdown: evaluation.metricBreakdown,
      finalScoreBreakdown: evaluation.finalScoreBreakdown,
    };
  }

  const delta = previousScore === null ? null : Math.round((finalScore - previousScore) * 100) / 100;

  return {
    policySnapshot,
    requiredFlow: [...CLIENT_LED_REQUIRED_FLOW],
    requireClientAssessment,
    enforcement: {
      clientAssessmentRequired: requireClientAssessment,
      clientAssessmentProvided: Boolean(input.clientAssessment),
      violationCode,
    },
    targetScore,
    passed,
    initialScore: initialAnalyzed.score,
    score: finalAnalyzed.score,
    finalScore,
    scoreModel,
    warnings,
    hardFailures,
    analysis: {
      provider: finalAnalyzed.provider,
      requestedProvider: finalAnalyzed.requestedProvider,
      fallbackUsed: finalAnalyzed.fallbackUsed,
      fallbackReason: finalAnalyzed.fallbackReason,
      confidence: finalAnalyzed.confidence,
      contextSummary: finalAnalyzed.contextSummary,
    },
    patch,
    exportValidation,
    clientScoring,
    iteration: {
      iterationIndex,
      previousScore,
      currentScore: finalScore,
      delta,
      remainingGaps,
    },
    nextBestActions,
    finalContent,
  };
}

export function registerQualityGateArtifactTool(server: McpServer): void {
  server.registerTool(
    "quality_gate_artifact",
    {
      title: "Quality Gate Artifact",
      description:
        "Default artifact QA gate for client-led workflows. In fix/update flows clientAssessment is required by default; run prepare_artifact_fix_context and submit_client_assessment first, then call this tool with candidateContent + clientAssessment for weighted final scoring.",
      inputSchema: asInputSchema(qualityGateArtifactInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: QualityGateArtifactInput) => {
      try {
        const output = await executeQualityGateArtifactTool(args);
        const hardFailLabel = output.hardFailures.length > 0 ? ` hardFailures=${output.hardFailures.length}` : "";
        return toToolResult({
          summary: `passed=${output.passed} score=${output.initialScore}->${output.score} final=${output.finalScore} model=${output.scoreModel} target=${output.targetScore} exportValid=${output.exportValidation.valid}${hardFailLabel}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `quality_gate_artifact failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    }),
  );
}
