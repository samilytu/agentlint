// @agent-lint/shared — Common types, parser, conventions, schemas

export { artifactTypeValues, artifactTypeSchema } from "./artifacts.js";
export type { ArtifactType } from "./artifacts.js";

export { parseArtifactContent } from "./parser.js";
export type { ParsedArtifactContent } from "./parser.js";

export type { PromptPack } from "./types.js";

// --- Conventions ---
export { qualityMetricIds, getMetricGuidanceList, getMetricGuidance } from "./conventions/scoring.js";
export type { QualityMetricId, MetricGuidance } from "./conventions/scoring.js";

export { getArtifactPathHints, buildArtifactPathHintsMarkdown } from "./conventions/path-hints.js";
export type { ArtifactPathHint } from "./conventions/path-hints.js";

export { buildArtifactSpecMarkdown } from "./conventions/specs.js";

// --- Schemas (MCP tool input/output) ---
export {
  MCP_TOOL_NAMES,
  mcpClientValues,
  mcpClientSchema,
  getGuidelinesInputSchema,
  planWorkspaceAutofixInputSchema,
  quickCheckInputSchema,
  emitMaintenanceSnippetInputSchema,
} from "./schemas.js";
export type {
  McpToolName,
  McpClient,
  GetGuidelinesInput,
  PlanWorkspaceAutofixInput,
  QuickCheckInput,
  EmitMaintenanceSnippetInput,
} from "./schemas.js";
