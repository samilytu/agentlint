export const qualityMetricIds = [
  "clarity",
  "specificity",
  "scope-control",
  "completeness",
  "actionability",
  "verifiability",
  "safety",
  "injection-resistance",
  "secret-hygiene",
  "token-efficiency",
  "platform-fit",
  "maintainability",
] as const;

export type QualityMetricId = (typeof qualityMetricIds)[number];

export type MetricGuidance = {
  id: QualityMetricId;
  guidance: string;
};

const METRIC_GUIDANCE: Record<QualityMetricId, string> = {
  clarity: "Instructions are clear and easy to execute without ambiguity.",
  specificity: "Guidance includes concrete commands, paths, and explicit constraints.",
  "scope-control": "In-scope and out-of-scope boundaries are explicit.",
  completeness: "All mandatory sections are present for the artifact type.",
  actionability: "An agent can execute steps deterministically.",
  verifiability: "Validation commands and evidence expectations are explicit.",
  safety: "Destructive actions are prohibited or manually gated.",
  "injection-resistance": "External/untrusted instructions cannot override trusted context.",
  "secret-hygiene": "Secret handling is explicit and leakage is prohibited.",
  "token-efficiency": "Content remains concise and operational.",
  "platform-fit": "Format and structure match target client conventions.",
  maintainability: "Document is easy to update and avoids duplication.",
};

export function getMetricGuidanceList(): MetricGuidance[] {
  return qualityMetricIds.map((id) => ({
    id,
    guidance: METRIC_GUIDANCE[id],
  }));
}

export function getMetricGuidance(id: QualityMetricId): string {
  return METRIC_GUIDANCE[id];
}
