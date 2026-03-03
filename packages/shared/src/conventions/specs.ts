import type { ArtifactType } from "../artifacts.js";

import { buildArtifactPathHintsMarkdown } from "./path-hints.js";

function sectionsForType(type: ArtifactType): string[] {
  if (type === "skills") {
    return [
      "YAML frontmatter: name + description (required), optional platform extensions",
      "When to use (trigger keywords and invocation boundaries)",
      "Repository evidence basis (stack/commands inferred from codebase)",
      "Clarification gate (ask only for blocking ambiguity)",
      "Purpose",
      "Scope (included/excluded)",
      "Inputs",
      "Step-by-step execution (deterministic)",
      "Output contract",
      "Verification commands",
      "Evidence format",
      "Safety notes and explicit DONTs",
    ];
  }

  if (type === "agents") {
    return [
      "Do block",
      "Don't block",
      "Repository evidence basis (stack/commands inferred from codebase)",
      "Clarification gate (ask only for blocking ambiguity)",
      "Quick commands",
      "Repo map",
      "Working rules",
      "When stuck / escalation path",
      "Verification steps",
      "Security boundaries",
      "PR/change checklist",
    ];
  }

  if (type === "rules") {
    return [
      "Scope declaration",
      "Activation mode",
      "Do block",
      "Don't block",
      "Verification commands",
      "Security block",
    ];
  }

  if (type === "workflows") {
    return [
      "Goal",
      "Preconditions",
      "Ordered steps",
      "Failure handling",
      "Verification and evidence",
      "Safety gates",
    ];
  }

  return [
    "Scope and goals",
    "Non-goals",
    "Current-state assumptions",
    "Risks and dependencies",
    "Phases with checklists",
    "Verification commands and acceptance criteria",
    "Delivery evidence",
  ];
}

function antiPatternsForType(type: ArtifactType): string[] {
  if (type === "skills") {
    return [
      "Missing frontmatter metadata",
      "No safety notes around side effects",
      "Description missing trigger conditions (what + when)",
      "Overlong SKILL body instead of references/scripts progressive disclosure",
      "Hardcoded stack/tooling assumptions without repository evidence",
      "Asking broad clarifications before scanning repository evidence",
      "No confirmation gate around side effects",
      "No verification/evidence output contract",
    ];
  }

  if (type === "agents") {
    return [
      "README duplication and narrative bloat",
      "Missing explicit Do and Don't blocks near top",
      "Rules that restate generic LLM knowledge instead of project-specific constraints",
      "Hardcoded stack/tooling assumptions without repository evidence",
      "Unnecessary clarifying questions when safe defaults exist",
      "No explicit destructive-command boundaries",
      "Overlong policy text that exceeds practical context limits",
    ];
  }

  if (type === "rules") {
    return [
      "Always-on mega-rules without scope limits",
      "No activation mode",
      "Rules that are impossible to verify",
    ];
  }

  if (type === "workflows") {
    return [
      "Unordered or ambiguous steps",
      "No failure path",
      "Implicit destructive actions",
    ];
  }

  return [
    "No phased breakdown",
    "No risk/dependency analysis",
    "No measurable acceptance criteria",
  ];
}

function qualityChecks(): string[] {
  return [
    "clarity",
    "safety",
    "tokenEfficiency",
    "completeness",
    "specificity",
    "scope-control",
    "verifiability",
    "actionability",
    "injection-resistance",
    "secret-hygiene",
    "platform-fit",
    "maintainability",
  ];
}

export function buildArtifactSpecMarkdown(type: ArtifactType): string {
  const sections = sectionsForType(type);
  const antiPatterns = antiPatternsForType(type);
  const checks = qualityChecks();

  const lines: string[] = [
    `# Artifact Spec: ${type}`,
    "",
    "Use this specification to create or update project context artifacts.",
    "",
    "## Mandatory sections",
    "",
    ...sections.map((section) => `- ${section}`),
    "",
    "## Quality checks",
    "",
    ...checks.map((check) => `- ${check}`),
    "",
    "## Anti-patterns to avoid",
    "",
    ...antiPatterns.map((item) => `- ${item}`),
    "",
    "## Recommended workflow",
    "",
    "1. Call agentlint_get_guidelines for the artifact type to understand requirements.",
    "2. Discover existing files using path hints above.",
    "3. Read each file and check against the mandatory sections list.",
    "4. Add missing sections, remove anti-patterns, apply quality checks.",
    "5. Verify the result matches all mandatory sections before saving.",
    "",
    "## Path hints",
    "",
    buildArtifactPathHintsMarkdown(type),
  ];

  return lines.join("\n");
}
