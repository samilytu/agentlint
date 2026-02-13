import type { ArtifactType } from "@/lib/artifacts";

const baseGuidelines = [
  "Use progressive disclosure and keep context minimal.",
  "Block dangerous command execution without explicit user approval.",
  "Favor deterministic, testable instructions over vague guidance.",
  "Optimize for token efficiency without losing critical constraints.",
].join(" ");

export const judgeSystemPrompts: Record<ArtifactType, string> = {
  skills: `${baseGuidelines} Ensure valid frontmatter and explicit input/output contracts for tools.`,
  agents: `${baseGuidelines} Keep AGENTS.md operational, concise, and repository-specific.`,
  rules: `${baseGuidelines} Enforce workspace-safe rules, no auto-force actions, and clear precedence.`,
  workflows: `${baseGuidelines} Require confirmation gates before destructive steps and add rollback guidance.`,
  plans: `${baseGuidelines} Structure plans in phases with exit criteria, risk notes, and measurable outcomes.`,
};
