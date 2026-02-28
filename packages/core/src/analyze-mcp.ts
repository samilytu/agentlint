import type { ArtifactType, ContextDocumentInput } from "@agent-lint/shared";
import type { JudgeDimensionScores, MetricExplanation } from "@agent-lint/shared";
import { validateMarkdownOrYaml } from "./validation.js";
import { sanitizeUserInput } from "./sanitize.js";

import { analyzeArtifact } from "./analyzer.js";
import { buildContextBundle, type ContextBundleSummary } from "./context-bundle.js";

const DEFAULT_DIMENSIONS: JudgeDimensionScores = {
  clarity: 75,
  safety: 75,
  tokenEfficiency: 75,
  completeness: 75,
};

export type AnalyzeArtifactMcpCoreInput = {
  type: ArtifactType;
  content: string;
  contextDocuments?: ContextDocumentInput[];
  analysisEnabled?: boolean;
};

export type AnalyzeArtifactMcpCoreOutput = {
  requestedProvider: "deterministic";
  provider: "deterministic";
  fallbackUsed: false;
  fallbackReason: null;
  confidence: number;
  analysisMode: "deterministic";
  warnings: string[];
  contextSummary: ContextBundleSummary;
  mergedContent: string;
  sanitizedContent: string;
  result: {
    score: number;
    dimensions: JudgeDimensionScores;
    rationale: string;
    warnings: string[];
    refinedContent: string;
    analysis: ReturnType<typeof analyzeArtifact>;
  };
};

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

function findMetricScore(metrics: MetricExplanation[], id: string, fallback: number): number {
  const metric = metrics.find((item) => item.id === id);
  return metric ? metric.score : fallback;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deriveDimensions(metrics: MetricExplanation[]): JudgeDimensionScores {
  const clarity = findMetricScore(metrics, "clarity", DEFAULT_DIMENSIONS.clarity);
  const safety = average([
    findMetricScore(metrics, "safety", DEFAULT_DIMENSIONS.safety),
    findMetricScore(metrics, "injection-resistance", DEFAULT_DIMENSIONS.safety),
    findMetricScore(metrics, "secret-hygiene", DEFAULT_DIMENSIONS.safety),
  ]);
  const tokenEfficiency = findMetricScore(
    metrics,
    "token-efficiency",
    DEFAULT_DIMENSIONS.tokenEfficiency,
  );
  const completeness = average([
    findMetricScore(metrics, "completeness", DEFAULT_DIMENSIONS.completeness),
    findMetricScore(metrics, "actionability", DEFAULT_DIMENSIONS.completeness),
    findMetricScore(metrics, "verifiability", DEFAULT_DIMENSIONS.completeness),
    findMetricScore(metrics, "scope-control", DEFAULT_DIMENSIONS.completeness),
    findMetricScore(metrics, "platform-fit", DEFAULT_DIMENSIONS.completeness),
    findMetricScore(metrics, "maintainability", DEFAULT_DIMENSIONS.completeness),
  ]);

  return {
    clarity: clampScore(clarity),
    safety: clampScore(safety),
    tokenEfficiency: clampScore(tokenEfficiency),
    completeness: clampScore(completeness),
  };
}

function buildDeterministicWarnings(analysis: ReturnType<typeof analyzeArtifact>): string[] {
  const warnings: string[] = [];
  const blockingCount = analysis.missingItems.filter((item) => item.severity === "blocking").length;
  const criticalSignalCount = analysis.signals.filter((signal) => signal.severity === "critical").length;

  if (blockingCount > 0) {
    warnings.push(`Blocking checklist issues detected: ${blockingCount}`);
  }

  if (criticalSignalCount > 0) {
    warnings.push(`Critical static analyzer signals detected: ${criticalSignalCount}`);
  }

  return warnings;
}

function buildDeterministicRationale(input: {
  type: ArtifactType;
  score: number;
  dimensions: JudgeDimensionScores;
  missingCount: number;
  blockingCount: number;
  signalCount: number;
}): string {
  return [
    `Deterministic analysis for ${input.type} artifact completed.`,
    `Score ${input.score} is derived from clarity=${input.dimensions.clarity}, safety=${input.dimensions.safety}, tokenEfficiency=${input.dimensions.tokenEfficiency}, completeness=${input.dimensions.completeness}.`,
    `Checklist findings: ${input.missingCount} missing item(s), ${input.blockingCount} blocking item(s), ${input.signalCount} static signal(s).`,
  ].join(" ");
}

export async function analyzeArtifactMcpCore(
  input: AnalyzeArtifactMcpCoreInput,
): Promise<AnalyzeArtifactMcpCoreOutput> {
  const sanitized = sanitizeUserInput(input.content);
  const sanitizedContextDocs: ContextDocumentInput[] = [];
  const contextWarnings: string[] = [];

  for (const contextDoc of input.contextDocuments ?? []) {
    const sanitizedDoc = sanitizeUserInput(contextDoc.content);
    sanitizedContextDocs.push({
      ...contextDoc,
      content: sanitizedDoc.sanitizedContent,
    });

    for (const warning of sanitizedDoc.warnings) {
      contextWarnings.push(`[Context: ${contextDoc.label}] ${warning}`);
    }
  }

  const contextBundle = buildContextBundle({
    primaryContent: sanitized.sanitizedContent,
    contextDocuments: sanitizedContextDocs,
  });

  const analysisEnabled = input.analysisEnabled ?? true;

  const firstPassAnalysis = analyzeArtifact({
    type: input.type,
    content: sanitized.sanitizedContent,
    dimensions: DEFAULT_DIMENSIONS,
  });
  const derivedDimensions = deriveDimensions(firstPassAnalysis.metricExplanations);
  const analysis = analysisEnabled
    ? analyzeArtifact({
        type: input.type,
        content: sanitized.sanitizedContent,
        dimensions: derivedDimensions,
      })
    : firstPassAnalysis;

  const dimensions = deriveDimensions(analysis.metricExplanations);
  const score = clampScore(
    (dimensions.clarity + dimensions.safety + dimensions.tokenEfficiency + dimensions.completeness) / 4,
  );

  const missingCount = analysis.missingItems.length;
  const blockingCount = analysis.missingItems.filter((item) => item.severity === "blocking").length;
  const signalCount = analysis.signals.length;

  const deterministicWarnings = buildDeterministicWarnings(analysis);
  const warnings = [
    ...sanitized.warnings,
    ...contextWarnings,
    ...contextBundle.warnings,
    ...deterministicWarnings,
  ];

  if (contextBundle.summary.included > 0) {
    warnings.push(
      `Project Context Mode active: ${contextBundle.summary.included}/${contextBundle.summary.provided} context document(s) included.`,
    );
  }

  const exportValidation = validateMarkdownOrYaml(sanitized.sanitizedContent);
  if (!exportValidation.valid && exportValidation.reason) {
    warnings.push(`Export validation failed: ${exportValidation.reason}`);
  }

  warnings.push(
    "LLM-free MCP mode active: refinedContent mirrors sanitized input. Use your MCP client LLM to draft revisions and re-run quality checks.",
  );

  return {
    requestedProvider: "deterministic",
    provider: "deterministic",
    fallbackUsed: false,
    fallbackReason: null,
    confidence: analysis.confidence,
    analysisMode: "deterministic",
    warnings,
    contextSummary: contextBundle.summary,
    mergedContent: contextBundle.mergedContent,
    sanitizedContent: sanitized.sanitizedContent,
    result: {
      score,
      dimensions,
      rationale: buildDeterministicRationale({
        type: input.type,
        score,
        dimensions,
        missingCount,
        blockingCount,
        signalCount,
      }),
      warnings,
      refinedContent: sanitized.sanitizedContent,
      analysis,
    },
  };
}
