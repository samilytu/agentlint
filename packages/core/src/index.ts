// @agent-lint/core — Deterministic analysis engine + rules
// No LLM, no DB, no network. Pure static analysis.

export { analyzeArtifact } from "./analyzer.js";
export { buildInstantLintSignals } from "./instant-lint.js";
export type { InstantLintSeverity, InstantLintSignal } from "./instant-lint.js";
export { buildDiffSegments, applySelectedSegments } from "./diff.js";
export type { DiffSegmentKind, DiffSegment } from "./diff.js";
export { validateMarkdownOrYaml } from "./validation.js";
export type { ExportValidationResult } from "./validation.js";
export { sanitizeUserInput } from "./sanitize.js";
export type { SanitizationResult } from "./sanitize.js";
export { getPromptPack } from "./prompt-pack.js";

// Context bundle
export { buildContextBundle, getContextBundleCharBudget, DEFAULT_CONTEXT_BUNDLE_CHAR_BUDGET } from "./context-bundle.js";
export type { ContextBundleSummary, ContextBundleResult } from "./context-bundle.js";

// MCP-oriented deterministic analysis
export { analyzeArtifactMcpCore } from "./analyze-mcp.js";
export type { AnalyzeArtifactMcpCoreInput, AnalyzeArtifactMcpCoreOutput } from "./analyze-mcp.js";

// Prompt templates (judge system prompts per artifact type)
export { judgeSystemPrompts } from "./prompt-templates.js";

// File security (apply_patches guards)
export {
  computeSha256,
  verifyHash,
  validateWritePath,
  validatePatchSize,
  createBackup,
  rollbackFromBackup,
  writeWithHashGuard,
  applyPatchSecure,
} from "./file-security.js";
export type {
  FileSecurityError,
  FileSecurityResult,
  ApplyPatchOptions,
  ApplyPatchSuccess,
} from "./file-security.js";