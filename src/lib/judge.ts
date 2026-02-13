export type JudgeDimensionScores = {
  clarity: number;
  safety: number;
  tokenEfficiency: number;
  completeness: number;
};

export type JudgeResult = {
  score: number;
  dimensions: JudgeDimensionScores;
  rationale: string;
  warnings: string[];
  refinedContent: string;
};
