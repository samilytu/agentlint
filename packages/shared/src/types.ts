export type JudgeDimensionScores = {
  clarity: number;
  safety: number;
  tokenEfficiency: number;
  completeness: number;
};

export type QualityStatus = "pass" | "improve" | "fail";

export type MissingSeverity = "blocking" | "important" | "nice_to_have";

export type ChecklistItem = {
  id: string;
  label: string;
  status: QualityStatus;
  description: string;
  recommendation: string;
  evidence: string | null;
  metric: string;
};

export type MissingItem = {
  id: string;
  severity: MissingSeverity;
  title: string;
  description: string;
  recommendation: string;
};

export type MetricExplanation = {
  id: string;
  label: string;
  status: QualityStatus;
  score: number;
  definition: string;
  assessment: string;
  improvement: string;
};

export type BestPracticeHint = {
  id: string;
  title: string;
  why: string;
  goodExample: string;
  avoidExample: string;
};

export type PromptPack = {
  title: string;
  summary: string;
  prompt: string;
};

export type AnalyzerSignalSeverity = "info" | "warning" | "critical";

export type AnalyzerSignal = {
  id: string;
  category: "safety" | "structure" | "token" | "compatibility";
  severity: AnalyzerSignalSeverity;
  message: string;
  evidence: string;
};

export type ValidatedFindingDecision = "pass" | "warn" | "fail";

export type ValidatedFinding = {
  id: string;
  decision: ValidatedFindingDecision;
  rationale: string;
  relatedSignalIds: string[];
  confidence: number;
};

export type JudgeAnalysis = {
  checklist: ChecklistItem[];
  missingItems: MissingItem[];
  metricExplanations: MetricExplanation[];
  bestPracticeHints: BestPracticeHint[];
  promptPack: PromptPack;
  signals: AnalyzerSignal[];
  validatedFindings: ValidatedFinding[];
  confidence: number;
};

export type JudgeResult = {
  score: number;
  dimensions: JudgeDimensionScores;
  rationale: string;
  warnings: string[];
  refinedContent: string;
  analysis?: JudgeAnalysis;
};
