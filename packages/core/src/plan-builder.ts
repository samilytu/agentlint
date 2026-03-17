import type { ArtifactType } from "@agent-lint/shared";

import {
  discoverWorkspaceArtifacts,
  type WorkspaceDiscoveryResult,
  type DiscoveredArtifact,
  type MissingArtifact,
} from "./workspace-discovery.js";

export type WorkspaceAutofixPlan = {
  rootPath: string;
  discoveryResult: WorkspaceDiscoveryResult;
  summary: WorkspacePlanSummary;
  markdown: string;
};

export type WorkspacePlanSummary = {
  okCount: number;
  missingCount: number;
  incompleteCount: number;
  staleCount: number;
  conflictingCount: number;
  weakCount: number;
  totalFindingCount: number;
  activeArtifacts: string[];
  recommendedPromptMode: "broad-scan" | "targeted-maintenance";
};

function summarizeArtifactStatus(artifact: DiscoveredArtifact): {
  incomplete: boolean;
  stale: boolean;
  conflicting: boolean;
  weak: boolean;
  ok: boolean;
  labels: string[];
} {
  const incomplete = artifact.isEmpty || artifact.missingSections.length > 0;
  const stale = artifact.staleReferences.length > 0;
  const conflicting = artifact.crossToolLeaks.length > 0;
  const weak = artifact.placeholderSections.length > 0 || artifact.weakSignals.length > 0;
  const labels = [
    incomplete ? "incomplete" : null,
    stale ? "stale" : null,
    conflicting ? "conflicting" : null,
    weak ? "weak" : null,
  ].filter((value): value is string => value !== null);

  return {
    incomplete,
    stale,
    conflicting,
    weak,
    ok: labels.length === 0,
    labels: labels.length > 0 ? labels : ["ok"],
  };
}

function buildSummary(
  discovered: DiscoveredArtifact[],
  missing: MissingArtifact[],
): WorkspacePlanSummary {
  let okCount = 0;
  let incompleteCount = 0;
  let staleCount = 0;
  let conflictingCount = 0;
  let weakCount = 0;
  const missingCount = missing.length;

  for (const artifact of discovered) {
    const status = summarizeArtifactStatus(artifact);
    if (status.ok) {
      okCount++;
    }
    if (status.incomplete) {
      incompleteCount++;
    }
    if (status.stale) {
      staleCount++;
    }
    if (status.conflicting) {
      conflictingCount++;
    }
    if (status.weak) {
      weakCount++;
    }
  }

  const totalFindingCount =
    missingCount + incompleteCount + staleCount + conflictingCount + weakCount;
  const recommendedPromptMode = missingCount > 0 || incompleteCount > 0 || totalFindingCount > 3
    ? "broad-scan"
    : "targeted-maintenance";

  return {
    okCount,
    missingCount,
    incompleteCount,
    staleCount,
    conflictingCount,
    weakCount,
    totalFindingCount,
    activeArtifacts: discovered.map((artifact) => artifact.relativePath),
    recommendedPromptMode,
  };
}

function buildSummarySection(summary: WorkspacePlanSummary): string {
  return [
    "## Context summary",
    "",
    `- **OK:** ${summary.okCount}`,
    `- **Missing types:** ${summary.missingCount}`,
    `- **Incomplete:** ${summary.incompleteCount}`,
    `- **Stale:** ${summary.staleCount}`,
    `- **Conflicting:** ${summary.conflictingCount}`,
    `- **Weak but present:** ${summary.weakCount}`,
    `- **Recommended handoff mode:** ${summary.recommendedPromptMode === "broad-scan" ? "Broad scan" : "Targeted maintenance"}`,
  ].join("\n");
}

function buildDiscoveredSection(artifacts: DiscoveredArtifact[]): string {
  if (artifacts.length === 0) {
    return [
      "## Discovered artifacts",
      "",
      "No context artifact files were found in the workspace.",
    ].join("\n");
  }

  const lines = [
    "## Discovered artifacts",
    "",
    "| File | Type | Size | Status |",
    "| --- | --- | ---: | --- |",
  ];

  for (const artifact of artifacts) {
    const status = summarizeArtifactStatus(artifact).labels.join(", ");
    lines.push(
      `| \`${artifact.relativePath}\` | ${artifact.type} | ${artifact.sizeBytes}B | ${status} |`,
    );
  }

  return lines.join("\n");
}

function buildMissingSection(missing: MissingArtifact[]): string {
  if (missing.length === 0) {
    return "";
  }

  const lines = [
    "## Missing artifacts",
    "",
    "The following artifact types were not found in the workspace:",
    "",
  ];

  for (const item of missing) {
    const fallbackHint = item.fallbackPaths.length > 0
      ? ` Fallback candidates: ${item.fallbackPaths.map((value) => `\`${value}\``).join(", ")}.`
      : "";
    lines.push(`- **${item.type}**: ${item.reason} Suggested path: \`${item.suggestedPath}\`.${fallbackHint}`);
  }

  return lines.join("\n");
}

function buildIncompleteSection(discovered: DiscoveredArtifact[]): string {
  const items: string[] = [];

  for (const artifact of discovered) {
    if (artifact.isEmpty) {
      items.push(`\`${artifact.relativePath}\` exists but is empty.`);
      continue;
    }

    if (artifact.missingSections.length > 0) {
      items.push(
        `\`${artifact.relativePath}\` is missing required sections: ${artifact.missingSections.map((value) => `\`${value}\``).join(", ")}`,
      );
    }
  }

  return buildProblemSection("## Incomplete findings", items);
}

function buildProblemSection(
  title: string,
  items: string[],
): string {
  if (items.length === 0) {
    return "";
  }

  return [title, "", ...items.map((item) => `- ${item}`)].join("\n");
}

function buildStaleSection(discovered: DiscoveredArtifact[], missing: MissingArtifact[]): string {
  const items: string[] = [];

  for (const artifact of discovered) {
    if (artifact.staleReferences.length > 0) {
      items.push(
        `\`${artifact.relativePath}\` references missing paths: ${artifact.staleReferences.map((value) => `\`${value}\``).join(", ")}`,
      );
    }
  }

  for (const artifact of missing) {
    if (artifact.canonicalPathDrift) {
      items.push(
        `No canonical ${artifact.type} artifact exists. Fallback candidates were found at ${artifact.fallbackPaths.map((value) => `\`${value}\``).join(", ")}`,
      );
    }
  }

  return buildProblemSection("## Stale findings", items);
}

function buildConflictingSection(discovered: DiscoveredArtifact[]): string {
  const items = discovered
    .filter((artifact) => artifact.crossToolLeaks.length > 0)
    .map(
      (artifact) =>
        `\`${artifact.relativePath}\` mixes tool-specific concepts: ${artifact.crossToolLeaks.map((value) => `\`${value}\``).join(", ")}`,
    );

  return buildProblemSection("## Conflicting findings", items);
}

function buildWeakSection(discovered: DiscoveredArtifact[]): string {
  const items: string[] = [];

  for (const artifact of discovered) {
    if (artifact.placeholderSections.length > 0) {
      items.push(
        `\`${artifact.relativePath}\` has placeholder sections: ${artifact.placeholderSections.map((value) => `\`${value}\``).join(", ")}`,
      );
    }

    if (artifact.weakSignals.length > 0) {
      items.push(
        `\`${artifact.relativePath}\` needs stronger guidance: ${artifact.weakSignals.map((value) => `\`${value}\``).join(", ")}`,
      );
    }
  }

  return buildProblemSection("## Weak-but-present findings", items);
}

function splitWeakSignals(artifact: DiscoveredArtifact): {
  hygieneSignals: string[];
  qualitySignals: string[];
} {
  const hygieneSignals: string[] = [];
  const qualitySignals: string[] = [];

  for (const signal of artifact.weakSignals) {
    if (/CLAUDE\.local\.md/i.test(signal)) {
      hygieneSignals.push(signal);
      continue;
    }

    qualitySignals.push(signal);
  }

  return { hygieneSignals, qualitySignals };
}

function buildRemediationOrderSection(summary: WorkspacePlanSummary): string {
  const items: string[] = [];

  if (summary.missingCount > 0 || summary.incompleteCount > 0) {
    items.push("1. Fix missing artifact types and incomplete files so the workspace has a usable baseline.");
  }
  if (summary.conflictingCount > 0) {
    items.push("2. Remove security or hygiene issues such as wrong-tool guidance and local-only override drift.");
  }
  if (summary.staleCount > 0) {
    items.push("3. Repair stale references and canonical-path drift.");
  }
  if (summary.weakCount > 0) {
    items.push("4. Strengthen weak-but-present sections, placeholders, and thin verification guidance.");
  }

  return items.length === 0
    ? ["## Recommended remediation order", "", "No remediation ordering is needed while the workspace findings stay clear."].join("\n")
    : ["## Recommended remediation order", "", ...items].join("\n");
}

function buildActionSteps(
  discovered: DiscoveredArtifact[],
  missing: MissingArtifact[],
): string {
  const foundationalSteps: string[] = [];
  const hygieneSteps: string[] = [];
  const driftSteps: string[] = [];
  const qualitySteps: string[] = [];

  for (const artifact of missing) {
    if (artifact.canonicalPathDrift) {
      driftSteps.push(
        `**Repair canonical drift for ${artifact.type}**: Promote or migrate fallback candidates ${artifact.fallbackPaths.map((value) => `\`${value}\``).join(", ")} to the canonical location \`${artifact.suggestedPath}\` so discovery and maintenance stay predictable.`,
      );
    } else {
      foundationalSteps.push(
        `**Create \`${artifact.suggestedPath}\`**: No ${artifact.type} artifact exists. ` +
          `Call \`agentlint_get_guidelines({ type: "${artifact.type}" })\` for the full specification, ` +
          `then create the file using the template skeleton provided in the guidelines.`,
      );
    }
  }

  for (const artifact of discovered) {
    const { hygieneSignals, qualitySignals } = splitWeakSignals(artifact);

    if (artifact.isEmpty) {
      foundationalSteps.push(
        `**Populate \`${artifact.relativePath}\`**: This ${artifact.type} file is empty. ` +
          `Call \`agentlint_get_guidelines({ type: "${artifact.type}" })\` and fill in all mandatory sections.`,
      );
      continue;
    }

    if (artifact.missingSections.length > 0) {
      const sectionsList = artifact.missingSections
        .map((s) => `\`${s}\``)
        .join(", ");
      qualitySteps.push(
        `**Fix \`${artifact.relativePath}\`**: This ${artifact.type} file is missing sections: ${sectionsList}. ` +
          `Read the file, then add the missing sections following the guidelines from \`agentlint_get_guidelines({ type: "${artifact.type}" })\`.`,
      );
    }

    if (artifact.staleReferences.length > 0) {
      const referencesList = artifact.staleReferences.map((reference) => `\`${reference}\``).join(", ");
      driftSteps.push(
        `**Repair stale references in \`${artifact.relativePath}\`**: Remove or update missing path references ${referencesList}. ` +
          `Re-scan the repository evidence before keeping any path that no longer exists.`,
      );
    }

    if (artifact.crossToolLeaks.length > 0) {
      const leaksList = artifact.crossToolLeaks.map((value) => `\`${value}\``).join(", ");
      hygieneSteps.push(
        `**Remove wrong-tool guidance from \`${artifact.relativePath}\`**: This file mixes tool-specific concepts (${leaksList}). ` +
          `Keep tool-specific files scoped to the client that actually loads them.`,
      );
    }

    if (hygieneSignals.length > 0) {
      hygieneSteps.push(
        `**Fix local-only hygiene in \`${artifact.relativePath}\`**: Resolve ${hygieneSignals.map((value) => `\`${value}\``).join(", ")} so machine-local files and ignore rules stay aligned.`,
      );
    }

    if (artifact.placeholderSections.length > 0 || qualitySignals.length > 0) {
      const weaknesses = [
        ...artifact.placeholderSections.map((value) => `placeholder section \`${value}\``),
        ...qualitySignals.map((value) => `weak guidance: ${value}`),
      ].join(", ");
      qualitySteps.push(
        `**Strengthen \`${artifact.relativePath}\`**: Replace placeholders and weak guidance (${weaknesses}) with runnable, repository-backed instructions.`,
      );
    }
  }

  const orderedSteps = [
    ...foundationalSteps,
    ...hygieneSteps,
    ...driftSteps,
    ...qualitySteps,
  ];

  const steps = orderedSteps.map((step, index) => `${index + 1}. ${step}`);

  if (steps.length === 0) {
    return [
      "## Action plan",
      "",
      "All discovered artifacts have complete sections. No fixes needed.",
    ].join("\n");
  }

  return ["## Action plan", "", ...steps].join("\n");
}

function buildGuidelinesReferences(types: ArtifactType[]): string {
  const uniqueTypes = [...new Set(types)];
  if (uniqueTypes.length === 0) {
    return "";
  }

  const lines = [
    "## Guidelines references",
    "",
    "For each artifact type mentioned in the action plan, call the corresponding guidelines tool:",
    "",
  ];

  for (const type of uniqueTypes) {
    lines.push(
      `- **${type}**: \`agentlint_get_guidelines({ type: "${type}" })\` or read resource \`agentlint://guidelines/${type}\``,
    );
  }

  return lines.join("\n");
}

export function buildWorkspaceAutofixPlan(
  rootPath: string,
): WorkspaceAutofixPlan {
  const result = discoverWorkspaceArtifacts(rootPath);
  const summary = buildSummary(result.discovered, result.missing);

  const allTypes: ArtifactType[] = [
    ...result.discovered.map((d) => d.type),
    ...result.missing.map((m) => m.type),
  ];

  const sections = [
    `# Workspace Autofix Plan`,
    "",
    `Root: \`${result.rootPath}\``,
    "",
    `Found ${result.discovered.length} artifact file(s), ${result.missing.length} type(s) missing.`,
    "",
    "---",
    "",
    buildSummarySection(summary),
    "",
    buildDiscoveredSection(result.discovered),
    "",
    buildMissingSection(result.missing),
    "",
    buildIncompleteSection(result.discovered),
    "",
    buildStaleSection(result.discovered, result.missing),
    "",
    buildConflictingSection(result.discovered),
    "",
    buildWeakSection(result.discovered),
    "",
    buildRemediationOrderSection(summary),
    "",
    buildActionSteps(result.discovered, result.missing),
    "",
    buildGuidelinesReferences(allTypes),
    "",
    "---",
    "",
    "## Instructions for the LLM",
    "",
    "Execute the action plan above step by step:",
    "1. For each step, read the referenced file (if it exists).",
    "2. Call `agentlint_get_guidelines` for the artifact type to get the full specification.",
    "3. If you need to scan the codebase for project-specific information (tech stack, scripts, etc.), do so before writing.",
    "4. Apply safe context-artifact changes directly unless the user explicitly wants a different outcome or the host approval model requires a gate.",
    "5. Tell the user when Agent Lint guidance triggered or shaped the update.",
  ];

  return {
    rootPath: result.rootPath,
    discoveryResult: result,
    summary,
    markdown: sections.join("\n"),
  };
}
