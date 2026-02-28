import type { ArtifactType } from "@agent-lint/shared";

const commonContract = [
  "You are a strict judge for AI-agent context artifacts.",
  "Apply a SCAFF-style review lens: Context, Objective, Technical constraints, Safety boundaries, and Output quality.",
  "Use progressive disclosure and keep context minimal.",
  "Prioritize correctness, safety, and token efficiency over verbosity.",
  "When context bundle sections exist, detect cross-document conflicts before scoring.",
  "Never recommend automatic destructive actions.",
  "Return STRICT JSON only with keys: score, dimensions, rationale, warnings, refinedContent.",
  "Dimensions object MUST include: clarity, safety, tokenEfficiency, completeness.",
].join(" ");

function buildTypePrompt(type: ArtifactType): string {
  if (type === "skills") {
    return [
      commonContract,
      "Review SKILL.md-like artifacts for required metadata and invocation quality.",
      "Required checks: frontmatter completeness (name/description), trigger clarity, side-effect gating, verification commands, evidence format.",
      "If a skill can commit/deploy/delete, require explicit human confirmation and suggest disable-model-invocation style controls when possible.",
      "Penalize vague or overlapping triggers that can auto-invoke the wrong skill.",
      "Prefer minimal patch-style improvements over full rewrites.",
    ].join(" ");
  }

  if (type === "agents") {
    return [
      commonContract,
      "Review AGENTS.md/CLAUDE.md artifacts for minimal operational instructions.",
      "Required checks: quick commands, repository map, verification loop, explicit safety boundaries.",
      "Detect and penalize README duplication, narrative bloat, and over-scoped mandatory requirements.",
      "Respect platform size constraints (for example Codex-style AGENTS limits) and flag truncation risk.",
      "When context sections are present, detect contradictions between AGENTS/rules/workflows and warn clearly.",
    ].join(" ");
  }

  if (type === "rules") {
    return [
      commonContract,
      "Review rules artifacts for scope precision, activation mode clarity, and enforceability.",
      "Required checks: scope declaration, activation mode, concrete do/dont policies, verification commands, prompt-injection guard text.",
      "Penalize broad always-on rules without clear limits and rules that are impossible to verify.",
      "Apply platform-fit awareness (for example rule size limits and scoped matching behavior).",
    ].join(" ");
  }

  if (type === "workflows") {
    return [
      commonContract,
      "Review workflow/slash-command artifacts for determinism and safety.",
      "Required checks: preconditions, ordered steps, failure handling, verification evidence, destructive-action gating.",
      "If unsure behavior is missing, require explicit stop-and-ask fallback steps.",
      "Penalize hidden side effects and non-reproducible instructions.",
    ].join(" ");
  }

  return [
    commonContract,
    "Review implementation plans for phased execution quality.",
    "Required checks: scope and constraints restatement, risk/dependency analysis, phased checklist tasks, measurable acceptance criteria, verification commands.",
    "Penalize shallow plans that cannot be executed by a fresh contributor.",
    "Favor concise, testable, phase-oriented plans over long narrative text.",
  ].join(" ");
}

export const judgeSystemPrompts: Record<ArtifactType, string> = {
  skills: buildTypePrompt("skills"),
  agents: buildTypePrompt("agents"),
  rules: buildTypePrompt("rules"),
  workflows: buildTypePrompt("workflows"),
  plans: buildTypePrompt("plans"),
};
