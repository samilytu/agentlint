import type { McpClient } from "@agent-lint/shared";

export type MaintenanceSnippetResult = {
  snippet: string;
  targetPath: string;
  description: string;
  markdown: string;
};

const CORE_RULES = [
  "After any structural change (new module, new directory, new script, new dependency), call agentlint_quick_check with the changed paths to determine if context artifacts need updating.",
  "Before creating or updating any AGENTS.md, CLAUDE.md, skills, rules, workflows, or plans file, call agentlint_get_guidelines for the artifact type to get the full specification.",
  "When the user asks to review or fix context artifacts, call agentlint_plan_workspace_autofix to discover all artifacts and get a step-by-step fix plan.",
  "Apply recommended changes directly using your file editing capabilities. Do not wait for explicit confirmation.",
  "Keep context artifact files concise (under 10,000 characters). Reference external docs instead of duplicating content.",
];

function buildCursorSnippet(): MaintenanceSnippetResult {
  const snippet = [
    "---",
    "description: Agent Lint context maintenance rules",
    "globs: **/*",
    "alwaysApply: true",
    "---",
    "",
    "# Agent Lint Context Maintenance",
    "",
    ...CORE_RULES.map((rule) => `- ${rule}`),
  ].join("\n");

  return {
    snippet,
    targetPath: ".cursor/rules/agentlint-maintenance.mdc",
    description:
      "Cursor rule file that ensures the LLM agent maintains context artifacts automatically. This rule is always active.",
    markdown: buildMarkdownOutput(snippet, ".cursor/rules/agentlint-maintenance.mdc", "Cursor"),
  };
}

function buildWindsurfSnippet(): MaintenanceSnippetResult {
  const snippet = [
    "---",
    "description: Agent Lint context maintenance rules",
    "---",
    "",
    "# Agent Lint Context Maintenance",
    "",
    ...CORE_RULES.map((rule) => `- ${rule}`),
  ].join("\n");

  return {
    snippet,
    targetPath: ".windsurf/rules/agentlint-maintenance.md",
    description:
      "Windsurf rule file that ensures the LLM agent maintains context artifacts automatically.",
    markdown: buildMarkdownOutput(snippet, ".windsurf/rules/agentlint-maintenance.md", "Windsurf"),
  };
}

function buildVscodeSnippet(): MaintenanceSnippetResult {
  const snippet = CORE_RULES.map((rule) => `- ${rule}`).join("\n");

  return {
    snippet,
    targetPath: ".github/copilot-instructions.md",
    description:
      "GitHub Copilot instructions file. Append these rules to the existing file or create a new one.",
    markdown: buildMarkdownOutput(snippet, ".github/copilot-instructions.md", "VS Code / Copilot"),
  };
}

function buildClaudeCodeSnippet(): MaintenanceSnippetResult {
  const snippet = [
    "# Agent Lint Context Maintenance",
    "",
    ...CORE_RULES.map((rule) => `- ${rule}`),
  ].join("\n");

  return {
    snippet,
    targetPath: "CLAUDE.md",
    description:
      "Append these rules to your CLAUDE.md file. Claude Code auto-loads CLAUDE.md as project context.",
    markdown: buildMarkdownOutput(snippet, "CLAUDE.md", "Claude Code"),
  };
}

function buildGenericSnippet(): MaintenanceSnippetResult {
  const snippet = [
    "# Agent Lint Context Maintenance",
    "",
    ...CORE_RULES.map((rule) => `- ${rule}`),
  ].join("\n");

  return {
    snippet,
    targetPath: "AGENTS.md",
    description:
      "Append these rules to your AGENTS.md or equivalent context file.",
    markdown: buildMarkdownOutput(snippet, "AGENTS.md", "Generic"),
  };
}

function buildMarkdownOutput(snippet: string, targetPath: string, clientName: string): string {
  return [
    `# Maintenance Snippet for ${clientName}`,
    "",
    `Add the following to \`${targetPath}\` to enable continuous context maintenance:`,
    "",
    "```markdown",
    snippet,
    "```",
    "",
    "## What this does",
    "",
    "When these rules are present in your IDE's context, the LLM agent will:",
    "",
    "1. **Automatically check** if context artifacts need updating after structural changes.",
    "2. **Follow guidelines** when creating or updating any context artifact file.",
    "3. **Use the workspace autofix plan** when asked to review or fix all artifacts.",
    "4. **Apply changes directly** — do not wait for confirmation before creating or updating context artifacts.",
    "",
    "## How to apply",
    "",
    `1. Create or open \`${targetPath}\` in your project.`,
    "2. Paste the snippet above at the end of the file.",
    "3. Save the file. The rules will be active in your next LLM session.",
  ].join("\n");
}

export function buildMaintenanceSnippet(
  client: McpClient = "generic",
): MaintenanceSnippetResult {
  switch (client) {
    case "cursor":
      return buildCursorSnippet();
    case "windsurf":
      return buildWindsurfSnippet();
    case "vscode":
      return buildVscodeSnippet();
    case "claude-code":
      return buildClaudeCodeSnippet();
    default:
      return buildGenericSnippet();
  }
}
