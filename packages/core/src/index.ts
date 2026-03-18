// @agent-lint/core — Guidelines, workspace discovery, plan building
// No LLM, no DB, no network. No file writing.

export { getPromptPack } from "./prompt-pack.js";

export { buildGuidelines } from "./guidelines-builder.js";

export { getTemplate, buildTemplateMarkdown } from "./template-builder.js";

export {
  discoverWorkspaceArtifacts,
  type DiscoveredArtifact,
  type MissingArtifact,
  type WorkspaceDiscoveryResult,
} from "./workspace-discovery.js";

export {
  buildWorkspaceAutofixPlan,
  type WorkspaceAutofixPlan,
  type WorkspacePlanSummary,
} from "./plan-builder.js";

export {
  runQuickCheck,
  type QuickCheckSignal,
  type QuickCheckResult,
} from "./quick-check.js";

export {
  buildMaintenanceSnippet,
  type MaintenanceSnippetResult,
} from "./maintenance-snippet.js";

export {
  scoreArtifact,
  type DimensionScore,
  type ArtifactScoreResult,
} from "./score-artifact.js";
