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
  markdown: string;
};

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
    const status = artifact.isEmpty
      ? "EMPTY"
      : artifact.missingSections.length > 0
        ? `Missing ${artifact.missingSections.length} sections`
        : "OK";
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
    lines.push(`- **${item.type}**: ${item.reason} Suggested path: \`${item.suggestedPath}\``);
  }

  return lines.join("\n");
}

function buildActionSteps(
  discovered: DiscoveredArtifact[],
  missing: MissingArtifact[],
): string {
  const steps: string[] = [];
  let stepNum = 1;

  for (const artifact of missing) {
    steps.push(
      `${stepNum}. **Create \`${artifact.suggestedPath}\`**: No ${artifact.type} artifact exists. ` +
        `Call \`agentlint_get_guidelines({ type: "${artifact.type}" })\` for the full specification, ` +
        `then create the file using the template skeleton provided in the guidelines.`,
    );
    stepNum++;
  }

  for (const artifact of discovered) {
    if (artifact.isEmpty) {
      steps.push(
        `${stepNum}. **Populate \`${artifact.relativePath}\`**: This ${artifact.type} file is empty. ` +
          `Call \`agentlint_get_guidelines({ type: "${artifact.type}" })\` and fill in all mandatory sections.`,
      );
      stepNum++;
      continue;
    }

    if (artifact.missingSections.length > 0) {
      const sectionsList = artifact.missingSections
        .map((s) => `\`${s}\``)
        .join(", ");
      steps.push(
        `${stepNum}. **Fix \`${artifact.relativePath}\`**: This ${artifact.type} file is missing sections: ${sectionsList}. ` +
          `Read the file, then add the missing sections following the guidelines from \`agentlint_get_guidelines({ type: "${artifact.type}" })\`.`,
      );
      stepNum++;
    }
  }

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
    buildDiscoveredSection(result.discovered),
    "",
    buildMissingSection(result.missing),
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
    markdown: sections.join("\n"),
  };
}
