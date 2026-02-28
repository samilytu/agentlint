import { z } from "zod";

import {
  artifactTypeSchema,
  contextDocumentSchema,
  type ContextDocumentInput,
} from "./artifacts.js";
import { clientMetricIds } from "./conventions/scoring.js";

export const MCP_TOOL_NAMES = [
  "prepare_artifact_fix_context",
  "analyze_artifact",
  "analyze_context_bundle",
  "submit_client_assessment",
  "quality_gate_artifact",
  "suggest_patch",
  "validate_export",
  "analyze_workspace_artifacts",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export const MCP_TOOL_SCOPE_REQUIREMENTS: Record<McpToolName, string> = {
  prepare_artifact_fix_context: "analyze",
  analyze_artifact: "analyze",
  analyze_context_bundle: "analyze",
  submit_client_assessment: "analyze",
  quality_gate_artifact: "analyze",
  suggest_patch: "patch",
  validate_export: "validate",
  analyze_workspace_artifacts: "analyze",
};

export const clientMetricIdSchema = z.enum(clientMetricIds);

export const clientMetricScoreSchema = z.object({
  metric: clientMetricIdSchema,
  score: z.number().min(0).max(100),
});

const evidenceCitationSchema = z.object({
  filePath: z.string().min(1).max(512).optional(),
  lineStart: z.number().int().min(1).max(2_000_000).optional(),
  lineEnd: z.number().int().min(1).max(2_000_000).optional(),
  snippet: z.string().min(1).max(8_000),
  rationale: z.string().min(1).max(1_000).optional(),
});

export const clientMetricEvidenceSchema = z.object({
  metric: clientMetricIdSchema,
  summary: z.string().min(1).max(1_000).optional(),
  citations: z.array(evidenceCitationSchema).min(1).max(10),
});

export const clientAssessmentSchema = z.object({
  filePath: z.string().min(1).max(512).optional(),
  repositoryScanSummary: z
    .string()
    .min(1)
    .max(4_000)
    .describe("Summary of repository/context scan performed by the client before scoring."),
  scannedPaths: z.array(z.string().min(1).max(512)).max(200).optional(),
  metricScores: z
    .array(clientMetricScoreSchema)
    .min(1)
    .max(clientMetricIds.length)
    .describe("Client-side weighted scoring entries for each quality metric."),
  metricEvidence: z
    .array(clientMetricEvidenceSchema)
    .min(1)
    .max(clientMetricIds.length)
    .describe("Evidence citations for each metric score."),
  weightedScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Optional client-reported weighted score before server recomputation."),
  confidence: z.number().min(0).max(100).optional(),
  gaps: z.array(z.string().min(1).max(1_000)).max(50).optional(),
  rewritePlan: z.string().min(1).max(8_000).optional(),
});

export type ClientAssessmentInput = z.infer<typeof clientAssessmentSchema>;

export const mcpContextDocumentSchema = contextDocumentSchema;

export type McpContextDocument = ContextDocumentInput;

export const analyzeArtifactInputSchema = z.object({
  type: artifactTypeSchema.describe(
    "Artifact type. Use for AGENTS/skills/rules/workflows/plans creation, review, or edit validation.",
  ),
  content: z
    .string()
    .min(1)
    .max(1_000_000)
    .describe("Current artifact markdown/yaml content to analyze."),
  contextDocuments: z
    .array(mcpContextDocumentSchema)
    .max(20)
    .optional()
    .describe("Optional supporting docs (architecture, rules, roadmap) to improve cross-doc validation."),
  analysisEnabled: z
    .boolean()
    .optional()
    .describe("Enable enhanced analyzer signals/checklist mode."),
});

export type AnalyzeArtifactInput = z.infer<typeof analyzeArtifactInputSchema>;

export const prepareArtifactFixContextInputSchema = z.object({
  type: artifactTypeSchema.describe("Artifact type for preparing client-led fix context."),
  targetScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Optional target score override for this fix loop."),
  includeExamples: z
    .boolean()
    .optional()
    .describe("Include schema examples and flow hints in the response."),
});

export type PrepareArtifactFixContextInput = z.infer<typeof prepareArtifactFixContextInputSchema>;

export const analyzeContextBundleInputSchema = z.object({
  type: artifactTypeSchema.describe("Primary artifact type for context-aware analysis."),
  content: z
    .string()
    .min(1)
    .max(1_000_000)
    .describe("Primary artifact content."),
  contextDocuments: z
    .array(mcpContextDocumentSchema)
    .min(1)
    .max(20)
    .describe("Context bundle documents to merge and evaluate for conflicts."),
  analysisEnabled: z.boolean().optional().describe("Enable enhanced analyzer mode."),
  includeMergedContentPreview: z
    .boolean()
    .optional()
    .describe("Include merged content preview in response for debugging context assembly."),
});

export type AnalyzeContextBundleInput = z.infer<typeof analyzeContextBundleInputSchema>;

export const suggestPatchInputSchema = z.object({
  originalContent: z.string().describe("Original source content before lint/fix pass."),
  refinedContent: z.string().describe("Improved candidate content."),
  selectedSegmentIndexes: z
    .array(z.number().int().min(0))
    .optional()
    .describe("Optional list of diff segment indexes to apply. Omit to apply all changed segments."),
});

export type SuggestPatchInput = z.infer<typeof suggestPatchInputSchema>;

export const validateExportInputSchema = z.object({
  content: z
    .string()
    .min(1)
    .describe("Final markdown/yaml candidate to validate before presenting to users."),
});

export type ValidateExportInput = z.infer<typeof validateExportInputSchema>;

export const submitClientAssessmentInputSchema = z.object({
  type: artifactTypeSchema.describe("Artifact type for policy-weighted client assessment."),
  content: z
    .string()
    .min(1)
    .max(1_000_000)
    .describe("Current artifact content being evaluated."),
  contextDocuments: z
    .array(mcpContextDocumentSchema)
    .max(20)
    .optional()
    .describe("Optional supporting context documents used during server guardrail checks."),
  assessment: clientAssessmentSchema.describe(
    "Client-generated weighted scoring package with metric-level evidence.",
  ),
  targetScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Target score threshold for pass/fail evaluation."),
  analysisEnabled: z.boolean().optional().describe("Enable enhanced analyzer mode."),
});

export type SubmitClientAssessmentInput = z.infer<typeof submitClientAssessmentInputSchema>;

export const qualityGateArtifactInputSchema = z.object({
  type: artifactTypeSchema.describe("Artifact type for the quality gate pass."),
  content: z
    .string()
    .min(1)
    .max(1_000_000)
    .describe("Artifact content to gate with analyze -> (optional patch merge) -> validate pipeline."),
  contextDocuments: z
    .array(mcpContextDocumentSchema)
    .max(20)
    .optional()
    .describe("Optional context documents used during analysis."),
  targetScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Quality threshold used to determine pass/fail. Patch merge runs only when candidateContent is provided."),
  requireClientAssessment: z
    .boolean()
    .optional()
    .describe(
      "When true (default), quality gate requires clientAssessment to enforce client-led weighted scoring.",
    ),
  applyPatchWhenBelowTarget: z
    .boolean()
    .optional()
    .describe("Whether to apply patch generation when score is below target."),
  candidateContent: z
    .string()
    .optional()
    .describe(
      "Optional client-generated improved content. When provided and score is below target, suggest_patch can derive a selective merged output.",
    ),
  clientAssessment: clientAssessmentSchema
    .optional()
    .describe("Optional client-led scoring package used for weighted final score and directives."),
  selectedSegmentIndexes: z
    .array(z.number().int().min(0))
    .optional()
    .describe("Optional diff segment selection for patch output."),
  iterationIndex: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Optional quality-loop iteration number reported by client."),
  previousFinalScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Optional previous final score to compute score delta across iterations."),
  analysisEnabled: z.boolean().optional().describe("Enable enhanced analyzer mode."),
});

export type QualityGateArtifactInput = z.infer<typeof qualityGateArtifactInputSchema>;

export const analyzeWorkspaceArtifactsInputSchema = z.object({
  rootPath: z
    .string()
    .optional()
    .describe("Workspace root path. Defaults to current working directory."),
  maxFiles: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of candidate artifact files to analyze."),
  includePatterns: z
    .array(z.string().min(1).max(120))
    .max(20)
    .optional()
    .describe("Optional filename/path regex hints to include."),
  analysisEnabled: z.boolean().optional().describe("Enable enhanced analyzer mode."),
});

export type AnalyzeWorkspaceArtifactsInput = z.infer<typeof analyzeWorkspaceArtifactsInputSchema>;
