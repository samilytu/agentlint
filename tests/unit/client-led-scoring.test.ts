import { describe, expect, it } from "vitest";

import {
  clientMetricIds,
  combineClientAndGuardrailScores,
  computeClientWeightedScore,
  getArtifactScoringPolicy,
} from "@/mcp/conventions/client-led-scoring";
import { evaluateClientAssessment } from "@/mcp/tools/client-assessment-evaluator";

import type { AnalyzeArtifactToolOutput } from "@/mcp/tools/analyze-artifact";

function buildAnalyzeOutput(overrides: Partial<AnalyzeArtifactToolOutput> = {}): AnalyzeArtifactToolOutput {
  return {
    score: 85,
    requestedProvider: "deterministic",
    provider: "deterministic",
    fallbackUsed: false,
    fallbackReason: null,
    confidence: 90,
    warnings: [],
    refinedContent: "# AGENTS.md\n\nSample",
    contextSummary: {
      provided: 0,
      included: 0,
      truncated: 0,
      mergedChars: 0,
    },
    advisory: {
      missingItems: {
        total: 0,
        blocking: 0,
        important: 0,
        niceToHave: 0,
      },
      signals: {
        critical: 0,
        warning: 0,
        info: 0,
      },
      metricScores: [],
    },
    analysisMode: "deterministic",
    ...overrides,
  };
}

describe("client-led scoring policy", () => {
  it("uses valid weight presets and computes weighted score", () => {
    const policy = getArtifactScoringPolicy("agents");
    const sum = policy.metricWeights.reduce((total, item) => total + item.weightPercent, 0);
    expect(sum).toBe(100);

    const metricScores = Object.fromEntries(clientMetricIds.map((metric) => [metric, 80])) as Record<
      (typeof clientMetricIds)[number],
      number
    >;
    expect(computeClientWeightedScore(policy, metricScores)).toBe(80);

    const combined = combineClientAndGuardrailScores({
      policy,
      clientWeightedScore: 80,
      guardrailScore: 50,
    });
    expect(combined).toBe(77);
  });

  it("evaluates complete client assessment with pass result", () => {
    const assessment = {
      repositoryScanSummary: "Scanned root docs and .windsurf folders.",
      metricScores: clientMetricIds.map((metric) => ({ metric, score: 90 })),
      metricEvidence: clientMetricIds.map((metric) => ({
        metric,
        citations: [{ filePath: "AGENTS.md", lineStart: 1, snippet: `Evidence for ${metric}` }],
      })),
      weightedScore: 90,
      confidence: 88,
    };

    const evaluation = evaluateClientAssessment({
      type: "agents",
      assessment,
      analysis: buildAnalyzeOutput(),
      exportValidation: {
        valid: true,
        reason: null,
      },
      targetScore: 85,
    });

    expect(evaluation.hardFailures).toHaveLength(0);
    expect(evaluation.clientWeightedScore).toBe(90);
    expect(evaluation.serverGuardrailScore).toBe(100);
    expect(evaluation.finalScore).toBe(91);
    expect(evaluation.passed).toBe(true);
  });

  it("flags hard failures when coverage and guardrails are broken", () => {
    const evaluation = evaluateClientAssessment({
      type: "rules",
      assessment: {
        repositoryScanSummary: "Scanned docs only.",
        metricScores: [{ metric: "clarity", score: 70 }],
        metricEvidence: [{ metric: "clarity", citations: [{ snippet: "Only one citation" }] }],
      },
      analysis: buildAnalyzeOutput({
        advisory: {
          missingItems: {
            total: 4,
            blocking: 2,
            important: 1,
            niceToHave: 1,
          },
          signals: {
            critical: 1,
            warning: 2,
            info: 0,
          },
          metricScores: [],
        },
      }),
      exportValidation: {
        valid: false,
        reason: "Unclosed code fence.",
      },
      targetScore: 90,
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.hardFailures.some((item) => item.includes("Export validation failed"))).toBe(true);
    expect(evaluation.hardFailures.some((item) => item.includes("Critical analyzer signals"))).toBe(true);
    expect(evaluation.evidenceCoverage.missingScoreMetrics.length).toBeGreaterThan(0);
    expect(evaluation.evidenceCoverage.missingEvidenceMetrics.length).toBeGreaterThan(0);
  });
});
