import type { ArtifactType } from "@agent-lint/shared";
import {
  clientMetricIds,
  buildPolicySnapshot,
  combineClientAndGuardrailScores,
  computeClientWeightedScore,
  getArtifactScoringPolicy,
  normalizeScore,
  type ClientMetricId,
  type PolicySnapshot,
} from "@agent-lint/shared";
import type { ClientAssessmentInput } from "@agent-lint/shared";

import type { AnalyzeArtifactToolOutput } from "./analyze-artifact.js";

const SCORE_DELTA_TOLERANCE = 3;

function clampScore(score: number): number {
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return Math.round(score);
}

function toScoreMap(input: ClientAssessmentInput): {
  scoreMap: Partial<Record<ClientMetricId, number>>;
  duplicateScoreMetrics: ClientMetricId[];
} {
  const scoreMap: Partial<Record<ClientMetricId, number>> = {};
  const duplicateScoreMetrics: ClientMetricId[] = [];

  for (const item of input.metricScores) {
    if (typeof scoreMap[item.metric] === "number") {
      duplicateScoreMetrics.push(item.metric);
    }
    scoreMap[item.metric] = normalizeScore(item.score);
  }

  return {
    scoreMap,
    duplicateScoreMetrics,
  };
}

function toEvidenceMap(input: ClientAssessmentInput): {
  evidenceMap: Partial<Record<ClientMetricId, number>>;
  duplicateEvidenceMetrics: ClientMetricId[];
} {
  const evidenceMap: Partial<Record<ClientMetricId, number>> = {};
  const duplicateEvidenceMetrics: ClientMetricId[] = [];

  for (const item of input.metricEvidence) {
    if (typeof evidenceMap[item.metric] === "number") {
      duplicateEvidenceMetrics.push(item.metric);
    }
    evidenceMap[item.metric] = item.citations.length;
  }

  return {
    evidenceMap,
    duplicateEvidenceMetrics,
  };
}

function computeGuardrailScore(input: {
  analysis: AnalyzeArtifactToolOutput;
  exportValidation: {
    valid: boolean;
    reason: string | null;
  };
}): number {
  let score = 100;

  if (!input.exportValidation.valid) {
    score -= 35;
  }

  score -= Math.min(input.analysis.advisory.signals.critical * 15, 45);
  score -= Math.min(input.analysis.advisory.signals.warning * 4, 20);
  score -= Math.min(input.analysis.advisory.missingItems.blocking * 8, 32);
  score -= Math.min(input.analysis.advisory.missingItems.important * 2, 12);

  return clampScore(score);
}

export type ClientAssessmentEvaluation = {
  policySnapshot: PolicySnapshot;
  policyVersion: string;
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
    missingScoreMetrics: ClientMetricId[];
    missingEvidenceMetrics: ClientMetricId[];
  };
  consistency: {
    reportedWeightedScore: number | null;
    recomputedWeightedScore: number;
    delta: number;
    withinTolerance: boolean;
    duplicateScoreMetrics: ClientMetricId[];
    duplicateEvidenceMetrics: ClientMetricId[];
  };
  hardFailures: string[];
  warnings: string[];
  weightedGaps: Array<{
    metric: ClientMetricId;
    score: number;
    weightPercent: number;
    impact: number;
  }>;
  metricBreakdown: Array<{
    metric: ClientMetricId;
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
  nextBestActions: string[];
  passed: boolean;
};

export function evaluateClientAssessment(input: {
  type: ArtifactType;
  assessment: ClientAssessmentInput;
  analysis: AnalyzeArtifactToolOutput;
  exportValidation: {
    valid: boolean;
    reason: string | null;
  };
  targetScore: number;
}): ClientAssessmentEvaluation {
  const policy = getArtifactScoringPolicy(input.type);
  const policySnapshot = buildPolicySnapshot(input.type);
  const { scoreMap, duplicateScoreMetrics } = toScoreMap(input.assessment);
  const { evidenceMap, duplicateEvidenceMetrics } = toEvidenceMap(input.assessment);

  const requiredMetrics = policy.metricWeights.map((item) => item.metric);
  const missingScoreMetrics = requiredMetrics.filter((metric) => typeof scoreMap[metric] !== "number");
  const missingEvidenceMetrics = requiredMetrics.filter((metric) => (evidenceMap[metric] ?? 0) < 1);

  const clientWeightedScore = computeClientWeightedScore(policy, scoreMap);
  const guardrailScore = computeGuardrailScore({
    analysis: input.analysis,
    exportValidation: input.exportValidation,
  });
  const finalScore = combineClientAndGuardrailScores({
    policy,
    clientWeightedScore,
    guardrailScore,
  });

  const reportedScore = typeof input.assessment.weightedScore === "number" ? input.assessment.weightedScore : null;
  const scoreDelta = reportedScore === null ? 0 : Math.abs(clientWeightedScore - normalizeScore(reportedScore));
  const withinTolerance = reportedScore === null ? true : scoreDelta <= SCORE_DELTA_TOLERANCE;

  const hardFailures: string[] = [];
  if (!input.exportValidation.valid) {
    hardFailures.push(`Export validation failed: ${input.exportValidation.reason ?? "unknown reason"}`);
  }
  if (input.analysis.advisory.signals.critical > 0) {
    hardFailures.push(
      `Critical analyzer signals present: ${input.analysis.advisory.signals.critical}. Resolve before finalizing.`,
    );
  }
  if (missingScoreMetrics.length > 0) {
    hardFailures.push(`Missing metric scores: ${missingScoreMetrics.join(", ")}.`);
  }
  if (missingEvidenceMetrics.length > 0) {
    hardFailures.push(`Missing metric evidence: ${missingEvidenceMetrics.join(", ")}.`);
  }

  const warnings: string[] = [];
  if (!withinTolerance && reportedScore !== null) {
    warnings.push(
      `Client reported weightedScore=${normalizeScore(reportedScore)} differs from recomputed score=${clientWeightedScore} (delta=${scoreDelta}).`,
    );
  }
  if (duplicateScoreMetrics.length > 0) {
    warnings.push(`Duplicate metricScores entries detected: ${Array.from(new Set(duplicateScoreMetrics)).join(", ")}.`);
  }
  if (duplicateEvidenceMetrics.length > 0) {
    warnings.push(
      `Duplicate metricEvidence entries detected: ${Array.from(new Set(duplicateEvidenceMetrics)).join(", ")}.`,
    );
  }

  const weightedGaps = requiredMetrics
    .map((metric) => {
      const metricWeight = policy.metricWeights.find((item) => item.metric === metric);
      const weightPercent = metricWeight ? metricWeight.weightPercent : 0;
      const metricScore = normalizeScore(scoreMap[metric] ?? 0);
      const impact = Math.round((100 - metricScore) * (weightPercent / 100) * 100) / 100;
      return {
        metric,
        score: metricScore,
        weightPercent,
        impact,
      };
    })
    .sort((a, b) => b.impact - a.impact);

  const metricBreakdown = requiredMetrics.map((metric) => {
    const metricWeight = policy.metricWeights.find((item) => item.metric === metric);
    const weightPercent = metricWeight ? metricWeight.weightPercent : 0;
    const metricScore = normalizeScore(scoreMap[metric] ?? 0);
    const weightedContribution = Math.round(metricScore * (weightPercent / 100) * 100) / 100;
    const evidenceCount = evidenceMap[metric] ?? 0;
    return {
      metric,
      score: metricScore,
      weightPercent,
      weightedContribution,
      evidenceCount,
    };
  });

  const nextBestActions: string[] = [];
  for (const gap of weightedGaps.slice(0, 3)) {
    const metricPolicy = policy.metricWeights.find((item) => item.metric === gap.metric);
    if (!metricPolicy) {
      continue;
    }
    nextBestActions.push(
      `Raise ${gap.metric} (current ${gap.score}, weight ${gap.weightPercent}%): ${metricPolicy.guidance}`,
    );
  }

  if (!input.exportValidation.valid) {
    nextBestActions.push("Fix markdown/yaml export issues before another scoring pass.");
  }

  if (input.analysis.advisory.signals.critical > 0) {
    nextBestActions.push("Resolve critical safety signals (destructive actions or unsafe instructions) before final output.");
  }

  const passed = finalScore >= input.targetScore && hardFailures.length === 0;

  const blendedClientContribution =
    Math.round(clientWeightedScore * (policy.clientWeightPercent / 100) * 100) / 100;
  const blendedGuardrailContribution =
    Math.round(guardrailScore * (policy.guardrailWeightPercent / 100) * 100) / 100;

  return {
    policySnapshot,
    policyVersion: policy.version,
    targetScore: input.targetScore,
    clientWeightedScore,
    serverGuardrailScore: guardrailScore,
    finalScore,
    scoreComposition: {
      clientWeightPercent: policy.clientWeightPercent,
      guardrailWeightPercent: policy.guardrailWeightPercent,
      clientContribution: clampScore(clientWeightedScore * (policy.clientWeightPercent / 100)),
      guardrailContribution: clampScore(guardrailScore * (policy.guardrailWeightPercent / 100)),
    },
    evidenceCoverage: {
      requiredMetrics: clientMetricIds.length,
      coveredScoreMetrics: Object.keys(scoreMap).length,
      coveredEvidenceMetrics: Object.keys(evidenceMap).length,
      missingScoreMetrics,
      missingEvidenceMetrics,
    },
    consistency: {
      reportedWeightedScore: reportedScore === null ? null : normalizeScore(reportedScore),
      recomputedWeightedScore: clientWeightedScore,
      delta: scoreDelta,
      withinTolerance,
      duplicateScoreMetrics,
      duplicateEvidenceMetrics,
    },
    hardFailures,
    warnings,
    weightedGaps,
    metricBreakdown,
    finalScoreBreakdown: {
      formula: policySnapshot.formula,
      clientWeightedScore,
      serverGuardrailScore: guardrailScore,
      clientWeightPercent: policy.clientWeightPercent,
      guardrailWeightPercent: policy.guardrailWeightPercent,
      blendedClientContribution,
      blendedGuardrailContribution,
      finalScore,
    },
    nextBestActions: Array.from(new Set(nextBestActions)).slice(0, 5),
    passed,
  };
}
