import type { ArtifactType } from "../artifacts.js";

export const clientMetricIds = [
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

export type ClientMetricId = (typeof clientMetricIds)[number];

export type MetricWeight = {
  metric: ClientMetricId;
  weightPercent: number;
  importance: "critical" | "high" | "medium" | "low";
  guidance: string;
};

export type ArtifactScoringPolicy = {
  version: "client-led-v1";
  artifactType: ArtifactType;
  clientWeightPercent: number;
  guardrailWeightPercent: number;
  defaultTargetScore: number;
  metricWeights: MetricWeight[];
  guardrailNotes: string[];
  hardFailConditions: string[];
};

export type PolicySnapshot = {
  version: ArtifactScoringPolicy["version"];
  artifactType: ArtifactType;
  defaultTargetScore: number;
  clientWeightPercent: number;
  guardrailWeightPercent: number;
  formula: string;
  metricWeights: MetricWeight[];
  guardrailNotes: string[];
  hardFailConditions: string[];
};

export const CLIENT_LED_REQUIRED_FLOW = [
  "read_resources",
  "scan_repository",
  "submit_client_assessment",
  "rewrite_artifact",
  "quality_gate_artifact",
  "validate_export",
] as const;

type WeightPreset = Record<ArtifactType, Record<ClientMetricId, number>>;

const METRIC_GUIDANCE: Record<ClientMetricId, string> = {
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

const WEIGHT_PRESET: WeightPreset = {
  agents: {
    clarity: 10,
    specificity: 8,
    "scope-control": 8,
    completeness: 12,
    actionability: 10,
    verifiability: 10,
    safety: 15,
    "injection-resistance": 8,
    "secret-hygiene": 6,
    "token-efficiency": 4,
    "platform-fit": 3,
    maintainability: 6,
  },
  skills: {
    clarity: 8,
    specificity: 9,
    "scope-control": 7,
    completeness: 12,
    actionability: 12,
    verifiability: 10,
    safety: 12,
    "injection-resistance": 7,
    "secret-hygiene": 5,
    "token-efficiency": 4,
    "platform-fit": 8,
    maintainability: 6,
  },
  rules: {
    clarity: 8,
    specificity: 8,
    "scope-control": 14,
    completeness: 4,
    actionability: 10,
    verifiability: 8,
    safety: 14,
    "injection-resistance": 8,
    "secret-hygiene": 6,
    "token-efficiency": 4,
    "platform-fit": 10,
    maintainability: 6,
  },
  workflows: {
    clarity: 8,
    specificity: 8,
    "scope-control": 8,
    completeness: 12,
    actionability: 14,
    verifiability: 12,
    safety: 14,
    "injection-resistance": 3,
    "secret-hygiene": 2,
    "token-efficiency": 5,
    "platform-fit": 6,
    maintainability: 8,
  },
  plans: {
    clarity: 8,
    specificity: 8,
    "scope-control": 12,
    completeness: 12,
    actionability: 10,
    verifiability: 12,
    safety: 8,
    "injection-resistance": 4,
    "secret-hygiene": 3,
    "token-efficiency": 5,
    "platform-fit": 6,
    maintainability: 12,
  },
};

function toImportance(weightPercent: number): MetricWeight["importance"] {
  if (weightPercent >= 13) {
    return "critical";
  }
  if (weightPercent >= 9) {
    return "high";
  }
  if (weightPercent >= 6) {
    return "medium";
  }
  return "low";
}

function sumWeights(weights: Record<ClientMetricId, number>): number {
  return clientMetricIds.reduce((sum, metricId) => sum + (weights[metricId] ?? 0), 0);
}

function clampScore(score: number): number {
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return Math.round(score);
}

export function getArtifactScoringPolicy(type: ArtifactType): ArtifactScoringPolicy {
  const weights = WEIGHT_PRESET[type];
  const total = sumWeights(weights);
  if (total !== 100) {
    throw new Error(`Invalid weight preset for ${type}; expected 100, got ${total}.`);
  }

  return {
    version: "client-led-v1",
    artifactType: type,
    clientWeightPercent: 90,
    guardrailWeightPercent: 10,
    defaultTargetScore: 90,
    metricWeights: clientMetricIds.map((metric) => ({
      metric,
      weightPercent: weights[metric],
      importance: toImportance(weights[metric]),
      guidance: METRIC_GUIDANCE[metric],
    })),
    guardrailNotes: [
      "Server guardrail has low score weight (10%) and is used mainly for safety/export constraints.",
      "Guardrail score reflects export validity, critical analyzer signals, and blocking checklist findings.",
      "Client weighted scoring remains primary authority for quality progression.",
    ],
    hardFailConditions: [
      "Export validation fails (invalid markdown/yaml).",
      "Critical analyzer signals are present after rewrite.",
      "Required metric score or evidence coverage is incomplete.",
    ],
  };
}

export function normalizeScore(score: number): number {
  return clampScore(score);
}

export function computeClientWeightedScore(
  policy: ArtifactScoringPolicy,
  metricScores: Partial<Record<ClientMetricId, number>>,
): number {
  let weighted = 0;
  for (const metricWeight of policy.metricWeights) {
    const score = normalizeScore(metricScores[metricWeight.metric] ?? 0);
    weighted += score * (metricWeight.weightPercent / 100);
  }

  return clampScore(weighted);
}

export function combineClientAndGuardrailScores(input: {
  policy: ArtifactScoringPolicy;
  clientWeightedScore: number;
  guardrailScore: number;
}): number {
  const clientWeight = input.policy.clientWeightPercent / 100;
  const guardrailWeight = input.policy.guardrailWeightPercent / 100;
  return clampScore(input.clientWeightedScore * clientWeight + input.guardrailScore * guardrailWeight);
}

export function buildPolicySnapshot(type: ArtifactType): PolicySnapshot {
  const policy = getArtifactScoringPolicy(type);
  return {
    version: policy.version,
    artifactType: type,
    defaultTargetScore: policy.defaultTargetScore,
    clientWeightPercent: policy.clientWeightPercent,
    guardrailWeightPercent: policy.guardrailWeightPercent,
    formula: `final = clientWeighted*${policy.clientWeightPercent}% + serverGuardrail*${policy.guardrailWeightPercent}%`,
    metricWeights: policy.metricWeights,
    guardrailNotes: policy.guardrailNotes,
    hardFailConditions: policy.hardFailConditions,
  };
}

export function buildScoringPolicyMarkdown(type: ArtifactType): string {
  const policy = getArtifactScoringPolicy(type);

  const lines: string[] = [
    `# Client-led Scoring Policy: ${type}`,
    "",
    `Policy version: ${policy.version}`,
    `Default target score: ${policy.defaultTargetScore}`,
    `Final score formula: final = clientWeighted*${policy.clientWeightPercent}% + serverGuardrail*${policy.guardrailWeightPercent}%`,
    "",
    "## Metric weights",
    "",
    "| Metric | Weight | Importance | Guidance |",
    "| --- | ---: | --- | --- |",
  ];

  for (const metricWeight of policy.metricWeights) {
    lines.push(
      `| ${metricWeight.metric} | ${metricWeight.weightPercent}% | ${metricWeight.importance} | ${metricWeight.guidance} |`,
    );
  }

  lines.push("", "## Guardrail notes", "");
  for (const note of policy.guardrailNotes) {
    lines.push(`- ${note}`);
  }

  lines.push("", "## Hard-fail conditions", "");
  for (const condition of policy.hardFailConditions) {
    lines.push(`- ${condition}`);
  }

  return lines.join("\n");
}

export function buildAssessmentSchemaMarkdown(type: ArtifactType): string {
  const policy = getArtifactScoringPolicy(type);

  const metricList = policy.metricWeights.map((metricWeight) => metricWeight.metric);
  const lines: string[] = [
    `# Client Assessment Schema: ${type}`,
    "",
    "Client must provide an evidence-backed score package.",
    "",
    "## Required fields",
    "",
    "- metricScores: array of { metric, score(0-100) }",
    "- metricEvidence: array of { metric, citations[] }",
    "- repositoryScanSummary: short summary of what was scanned before scoring",
    "",
    "## Metric set",
    "",
    ...metricList.map((metric) => `- ${metric}`),
    "",
    "## Evidence citation format",
    "",
    "- filePath (optional but recommended)",
    "- lineStart / lineEnd (optional)",
    "- snippet (required)",
    "- rationale (optional)",
    "",
    "## Coverage rule",
    "",
    "- Every metric in the policy must have both score and at least one evidence citation.",
  ];

  return lines.join("\n");
}

export function buildImprovementPlaybookMarkdown(type: ArtifactType): string {
  const policy = getArtifactScoringPolicy(type);

  const lines: string[] = [
    `# Improvement Playbook: ${type}`,
    "",
    "Use this when client weighted score is below target.",
    "",
    "## Iteration loop",
    "",
    "1. Read scoring policy and artifact spec resources.",
    "2. Scan repository and identify canonical artifact files.",
    "3. Produce metric scores + evidence for all metrics.",
    "4. Submit assessment via submit_client_assessment.",
    "5. Rewrite artifact and run quality_gate_artifact with candidateContent + clientAssessment.",
    "6. Repeat until final score >= target and hard-fail conditions are clear.",
    "",
    "## Priority strategy",
    "",
    "Address lowest weighted-impact metrics first.",
    "",
    ...policy.metricWeights
      .slice()
      .sort((a, b) => b.weightPercent - a.weightPercent)
      .map((metricWeight) =>
        `- ${metricWeight.metric} (${metricWeight.weightPercent}%): ${metricWeight.guidance}`,
      ),
    "",
    "## Output expectation",
    "",
    "- Show old score -> new score delta per iteration.",
    "- Report remaining gaps and next best 3 actions.",
  ];

  return lines.join("\n");
}
