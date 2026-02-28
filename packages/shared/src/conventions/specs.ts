import type { ArtifactType } from "../artifacts.js";

import { buildArtifactPathHintsMarkdown } from "./path-hints.js";

function sectionsForType(type: ArtifactType): string[] {
  if (type === "skills") {
    return [
      "YAML frontmatter: name, description, disable-model-invocation",
      "Purpose",
      "Scope (included/excluded)",
      "Inputs",
      "Step-by-step execution",
      "Verification commands",
      "Evidence format",
      "Safety notes",
    ];
  }

  if (type === "agents") {
    return [
      "Quick commands",
      "Repo map",
      "Working rules",
      "Verification steps",
      "Security boundaries",
      "Do not do",
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
      "No confirmation gate around side effects",
      "No verification/evidence output contract",
    ];
  }

  if (type === "agents") {
    return [
      "README duplication and narrative bloat",
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
    "## Validation loop",
    "",
    "1. Discover files using path hints.",
    "2. Read scoring-policy and assessment-schema resources for this artifact type.",
    "3. Client LLM computes metric scores and evidence; call submit_client_assessment.",
    "4. Revise content in client LLM/editor.",
    "5. Re-run quality_gate_artifact with candidateContent + clientAssessment until target score is met.",
    "6. Run validate_export before final delivery.",
    "",
    "## Path hints",
    "",
    buildArtifactPathHintsMarkdown(type),
  ];

  return lines.join("\n");
}
