import type { ArtifactType } from "../artifacts.js";

export type ArtifactPathHint = {
  ecosystem: string;
  patterns: string[];
  examples: string[];
  notes?: string;
};

const AGENT_HINTS: ArtifactPathHint[] = [
  {
    ecosystem: "Root docs",
    patterns: ["AGENTS.md", "CLAUDE.md"],
    examples: ["AGENTS.md", "CLAUDE.md"],
    notes: "Prefer root-level files when available.",
  },
  {
    ecosystem: "Nested policy docs",
    patterns: ["**/.agents/**/*.md", "docs/**/agents*.md"],
    examples: [".agents/AGENTS.md", "docs/agent_guide.md"],
  },
];

const SKILL_HINTS: ArtifactPathHint[] = [
  {
    ecosystem: "Windsurf",
    patterns: [".windsurf/skills/**/SKILL.md", ".windsurf/skills/**/*.md"],
    examples: [".windsurf/skills/frontend/SKILL.md"],
  },
  {
    ecosystem: "Claude/Cline style",
    patterns: [".claude/skills/**/SKILL.md", ".skills/**/SKILL.md", "skills/**/SKILL.md"],
    examples: ["skills/release/SKILL.md", ".claude/skills/testing/SKILL.md"],
  },
  {
    ecosystem: "Agent Skills standard",
    patterns: [".agents/skills/**/SKILL.md", ".github/skills/**/SKILL.md"],
    examples: [".agents/skills/release/SKILL.md", ".github/skills/security-review/SKILL.md"],
  },
  {
    ecosystem: "Generic",
    patterns: ["**/*skill*.md", "**/SKILL.md"],
    examples: ["docs/skills/code-review-skill.md"],
    notes: "Use content heuristics when naming is inconsistent.",
  },
];

const RULE_HINTS: ArtifactPathHint[] = [
  {
    ecosystem: "Root/docs",
    patterns: ["rules.md", "docs/rules.md", "docs/**/*rule*.md"],
    examples: ["docs/rules.md", "rules.md"],
  },
  {
    ecosystem: "Editor-specific",
    patterns: [".cursor/rules/**/*.md", ".cursor/rules/**/*.mdc", ".windsurf/rules/**/*.md"],
    examples: [".cursor/rules/typescript.mdc"],
  },
];

const WORKFLOW_HINTS: ArtifactPathHint[] = [
  {
    ecosystem: "Slash-command docs",
    patterns: ["docs/workflows/**/*.md", "docs/commands/**/*.md", "**/*workflow*.md"],
    examples: ["docs/workflows/release.md", "docs/commands/fix.md"],
  },
  {
    ecosystem: "Client command folders",
    patterns: [".claude/commands/**/*.md", ".windsurf/workflows/**/*.md"],
    examples: [".claude/commands/review.md"],
  },
];

const PLAN_HINTS: ArtifactPathHint[] = [
  {
    ecosystem: "Roadmap/plan docs",
    patterns: ["docs/**/*plan*.md", "docs/**/*roadmap*.md", "docs/**/*backlog*.md"],
    examples: ["docs/phased_implementation_plan.md", "docs/roadmap_master.md"],
  },
  {
    ecosystem: "Top-level planning",
    patterns: ["PLAN.md", "great_plan.md", "PRD.md"],
    examples: ["docs/great_plan.md", "docs/PRD.md"],
  },
];

export function getArtifactPathHints(type: ArtifactType): ArtifactPathHint[] {
  if (type === "agents") {
    return AGENT_HINTS;
  }
  if (type === "skills") {
    return SKILL_HINTS;
  }
  if (type === "rules") {
    return RULE_HINTS;
  }
  if (type === "workflows") {
    return WORKFLOW_HINTS;
  }

  return PLAN_HINTS;
}

export function buildArtifactPathHintsMarkdown(type: ArtifactType): string {
  const hints = getArtifactPathHints(type);

  const lines: string[] = [
    `# Artifact Path Hints: ${type}`,
    "",
    "Use these patterns to discover relevant files in the current repository.",
    "Search in order and stop once canonical files are found.",
    "",
  ];

  for (const hint of hints) {
    lines.push(`## ${hint.ecosystem}`);
    lines.push("");
    lines.push("Patterns:");
    for (const pattern of hint.patterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push("");
    lines.push("Examples:");
    for (const example of hint.examples) {
      lines.push(`- ${example}`);
    }
    if (hint.notes) {
      lines.push("");
      lines.push(`Notes: ${hint.notes}`);
    }
    lines.push("");
  }

  lines.push("## Recommended discovery flow");
  lines.push("");
  lines.push("1. Search canonical filenames first.");
  lines.push("2. Search ecosystem-specific hidden folders (.windsurf/.claude/.cursor/.agents).");
  lines.push("3. Fallback to broad pattern matches and validate using content heuristics.");
  lines.push("");
  lines.push("## Project signals to inspect before rewriting");
  lines.push("");
  lines.push("- package scripts and CI workflows for verification commands.");
  lines.push("- Security and deployment docs for safety boundaries.");
  lines.push("- Existing roadmap/backlog docs for project-specific constraints.");

  return lines.join("\n");
}
