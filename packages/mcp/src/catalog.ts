export const CURRENT_TOOL_IDS = [
  "agentlint_get_guidelines",
  "agentlint_plan_workspace_autofix",
  "agentlint_quick_check",
  "agentlint_emit_maintenance_snippet",
  "agentlint_score_artifact",
] as const;

export const CURRENT_RESOURCE_URIS = [
  "agentlint://guidelines/{type}",
  "agentlint://template/{type}",
  "agentlint://path-hints/{type}",
] as const;

export const CURRENT_TOOL_TIMEOUTS: Record<(typeof CURRENT_TOOL_IDS)[number], number> = {
  agentlint_get_guidelines: 30_000,
  agentlint_plan_workspace_autofix: 60_000,
  agentlint_quick_check: 30_000,
  agentlint_emit_maintenance_snippet: 10_000,
  agentlint_score_artifact: 30_000,
};

export const LEGACY_TOOL_TIMEOUT_ALIASES: Record<string, number> = {
  analyze_artifact: 30_000,
  analyze_workspace_artifacts: 60_000,
  analyze_context_bundle: 30_000,
  prepare_artifact_fix_context: 30_000,
  submit_client_assessment: 30_000,
  suggest_patch: 30_000,
  quality_gate_artifact: 30_000,
  apply_patches: 15_000,
  validate_export: 10_000,
};
