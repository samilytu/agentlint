// @agent-lint/shared — Common types, parser, utils, conventions
// This is the foundation package with zero heavy dependencies

export { artifactTypeValues, artifactTypeSchema } from "./artifacts.js";
export type {
  ArtifactType,
  BaseArtifact,
  SkillArtifact,
  AgentArtifact,
  RuleArtifact,
  WorkflowArtifact,
  PlanArtifact,
  ArtifactPayload,
  ContextDocumentInput,
} from "./artifacts.js";
export { contextDocumentSchema, artifactSubmissionSchema } from "./artifacts.js";

export { parseArtifactContent } from "./parser.js";
export type { ParsedArtifactContent } from "./parser.js";

export type {
  JudgeDimensionScores,
  QualityStatus,
  MissingSeverity,
  ChecklistItem,
  MissingItem,
  MetricExplanation,
  BestPracticeHint,
  PromptPack,
  AnalyzerSignalSeverity,
  AnalyzerSignal,
  ValidatedFindingDecision,
  ValidatedFinding,
  JudgeAnalysis,
  JudgeResult,
} from "./types.js";

// --- Conventions ---
export { clientMetricIds } from "./conventions/scoring.js";
export type {
  ClientMetricId,
  MetricWeight,
  ArtifactScoringPolicy,
  PolicySnapshot,
} from "./conventions/scoring.js";
export {
  CLIENT_LED_REQUIRED_FLOW,
  getArtifactScoringPolicy,
  normalizeScore,
  computeClientWeightedScore,
  combineClientAndGuardrailScores,
  buildPolicySnapshot,
  buildScoringPolicyMarkdown,
  buildAssessmentSchemaMarkdown,
  buildImprovementPlaybookMarkdown,
} from "./conventions/scoring.js";

export { getArtifactPathHints, buildArtifactPathHintsMarkdown } from "./conventions/path-hints.js";
export type { ArtifactPathHint } from "./conventions/path-hints.js";

export { buildArtifactSpecMarkdown } from "./conventions/specs.js";

// --- Schemas (MCP tool input/output) ---
export {
  MCP_TOOL_NAMES,
  MCP_TOOL_SCOPE_REQUIREMENTS,
  clientMetricIdSchema,
  clientMetricScoreSchema,
  clientMetricEvidenceSchema,
  clientAssessmentSchema,
  mcpContextDocumentSchema,
  analyzeArtifactInputSchema,
  prepareArtifactFixContextInputSchema,
  analyzeContextBundleInputSchema,
  suggestPatchInputSchema,
  validateExportInputSchema,
  submitClientAssessmentInputSchema,
  qualityGateArtifactInputSchema,
  analyzeWorkspaceArtifactsInputSchema,
} from "./schemas.js";
export type {
  McpToolName,
  ClientAssessmentInput,
  McpContextDocument,
  AnalyzeArtifactInput,
  PrepareArtifactFixContextInput,
  AnalyzeContextBundleInput,
  SuggestPatchInput,
  ValidateExportInput,
  SubmitClientAssessmentInput,
  QualityGateArtifactInput,
  AnalyzeWorkspaceArtifactsInput,
} from "./schemas.js";
