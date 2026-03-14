import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildMaintenanceSnippet } from "@agent-lint/core";

function normalizeSnippet(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/(?:\n)+$/u, "");
}

describe("maintenance-snippet", () => {
  it("returns the expected target paths", () => {
    expect(buildMaintenanceSnippet("cursor").targetPath).toBe(".cursor/rules/agentlint-maintenance.mdc");
    expect(buildMaintenanceSnippet("windsurf").targetPath).toBe(".windsurf/rules/agentlint-maintenance.md");
    expect(buildMaintenanceSnippet("vscode").targetPath).toBe(".github/copilot-instructions.md");
    expect(buildMaintenanceSnippet("claude-desktop").targetPath).toBe("CLAUDE.md");
    expect(buildMaintenanceSnippet("claude-code").targetPath).toBe("CLAUDE.md");
    expect(buildMaintenanceSnippet("generic").targetPath).toBe("AGENTS.md");
    expect(buildMaintenanceSnippet().targetPath).toBe("AGENTS.md");
  });

  it("renders managed rule files with full section coverage", () => {
    const clients = ["cursor", "windsurf"] as const;

    for (const client of clients) {
      const snippet = buildMaintenanceSnippet(client).snippet;
      expect(snippet).toContain("# Scope");
      expect(snippet).toContain("# Activation");
      expect(snippet).toContain("# Do");
      expect(snippet).toContain("# Don't");
      expect(snippet).toContain("# Verification");
      expect(snippet).toContain("# Security");
      expect(snippet).toContain("Tell the user when an update was triggered or shaped by Agent Lint maintenance guidance.");
    }
  });

  it("renders append-based snippets as titled maintenance blocks", () => {
    const clients = ["vscode", "claude-desktop", "claude-code", "generic"] as const;

    for (const client of clients) {
      const snippet = buildMaintenanceSnippet(client).snippet;
      expect(snippet).toContain("## Agent Lint Context Maintenance");
      expect(snippet).toContain("### Scope");
      expect(snippet).toContain("### Activation");
      expect(snippet).toContain("### Do");
      expect(snippet).toContain("### Don't");
      expect(snippet).toContain("### Verification");
      expect(snippet).toContain("### Security");
    }
  });

  it("keeps the dedicated Cursor artifact in parity with the generated snippet", () => {
    const generated = buildMaintenanceSnippet("cursor").snippet;
    const checkedIn = readFileSync(
      new URL("../../../.cursor/rules/agentlint-maintenance.mdc", import.meta.url),
      "utf-8",
    );

    expect(normalizeSnippet(generated)).toBe(normalizeSnippet(checkedIn));
  });

  it("keeps the dedicated Windsurf artifact in parity with the generated snippet", () => {
    const generated = buildMaintenanceSnippet("windsurf").snippet;
    const checkedIn = readFileSync(
      new URL("../../../.windsurf/rules/agentlint-maintenance.md", import.meta.url),
      "utf-8",
    );

    expect(normalizeSnippet(generated)).toBe(normalizeSnippet(checkedIn));
  });

  it("keeps the Copilot instructions artifact in parity with the generated snippet", () => {
    const generated = buildMaintenanceSnippet("vscode").snippet;
    const checkedIn = readFileSync(
      new URL("../../../.github/copilot-instructions.md", import.meta.url),
      "utf-8",
    );

    expect(normalizeSnippet(generated)).toBe(normalizeSnippet(checkedIn));
  });

  it("describes the intended Agent Lint workflow and bounded auto-apply policy", () => {
    const snippet = buildMaintenanceSnippet("generic").snippet;

    expect(snippet).toContain("agentlint_plan_workspace_autofix");
    expect(snippet).toContain("agentlint_quick_check");
    expect(snippet).toContain("agentlint_get_guidelines");
    expect(snippet).toContain("agentlint_emit_maintenance_snippet");
    expect(snippet).toContain("unless the user explicitly asks for a different maintenance outcome");
    expect(snippet).toContain("Do not expand this maintenance policy to unrelated code or docs outside context artifacts unless the user explicitly asks.");
  });

  it("documents replace and append install modes in markdown output", () => {
    const replaceMarkdown = buildMaintenanceSnippet("cursor").markdown;
    const appendMarkdown = buildMaintenanceSnippet("generic").markdown;
    const claudeDesktopMarkdown = buildMaintenanceSnippet("claude-desktop").markdown;

    expect(replaceMarkdown).toContain("Replace the managed file contents with the snippet above.");
    expect(appendMarkdown).toContain("Append the snippet above to the end of the file.");
    expect(claudeDesktopMarkdown).toContain("Maintenance Snippet for Claude Desktop");
  });
});
