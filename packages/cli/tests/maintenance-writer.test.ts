import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLIENT_REGISTRY,
  type ClientId,
} from "../src/commands/clients.js";
import { installMaintenanceRule } from "../src/commands/maintenance-writer.js";

function getClient(id: ClientId) {
  const client = CLIENT_REGISTRY.find((entry) => entry.id === id);
  if (!client) {
    throw new Error(`Missing client fixture for ${id}`);
  }
  return client;
}

describe("installMaintenanceRule", () => {
  it("writes a dedicated cursor rule file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-cursor-"));

    try {
      const result = installMaintenanceRule(getClient("cursor"), tmpDir);
      expect(result.status).toBe("created");
      expect(fs.existsSync(path.join(tmpDir, ".cursor", "rules", "agentlint-maintenance.mdc"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("falls back to AGENTS.md for unsupported clients", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-generic-"));

    try {
      const result = installMaintenanceRule(getClient("codex"), tmpDir);
      expect(result.status).toBe("created");
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
      expect(fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8")).toContain("Agent Lint Context Maintenance");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("keeps non-Claude clients on AGENTS.md even if CLAUDE.md already exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-claude-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Project Claude\n", "utf-8");
      const result = installMaintenanceRule(getClient("zed"), tmpDir);

      expect(result.status).toBe("created");
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
      expect(fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8")).not.toContain("Agent Lint Context Maintenance");
      expect(fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8")).toContain("Agent Lint Context Maintenance");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("uses CLAUDE.md for Claude Desktop maintenance instructions", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-claude-desktop-"));

    try {
      const result = installMaintenanceRule(getClient("claude-desktop"), tmpDir);

      expect(result.status).toBe("created");
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(false);
      expect(fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8")).toContain("Agent Lint Context Maintenance");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a backup before appending to an existing AGENTS.md file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-append-backup-"));

    try {
      const targetPath = path.join(tmpDir, "AGENTS.md");
      fs.writeFileSync(targetPath, "# Project Agents\n", "utf-8");

      const result = installMaintenanceRule(getClient("codex"), tmpDir);

      expect(result.status).toBe("appended");
      expect(fs.existsSync(`${targetPath}.bak`)).toBe(true);
      expect(fs.readFileSync(`${targetPath}.bak`, "utf-8")).toBe("# Project Agents\n");
      expect(fs.readFileSync(targetPath, "utf-8")).toContain("Agent Lint Context Maintenance");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("updates a legacy appended maintenance block instead of duplicating it", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-legacy-update-"));

    try {
      const targetPath = path.join(tmpDir, ".github", "copilot-instructions.md");
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(
        targetPath,
        [
          "# Existing Instructions",
          "",
          "- Keep changes reviewable.",
          "",
          "- Treat natural language requests about stale, missing, inconsistent, or low-quality AGENTS.md, CLAUDE.md, rules, skills, workflows, or plans as Agent Lint work even if the user does not name Agent Lint explicitly.",
          "- Treat structural change signals such as new modules, new directories, dependency changes, CI/config updates, environment/security changes, or repository reorganization as reasons to check whether context artifacts need updates.",
          "- For full workspace review or fix requests, start with agentlint_plan_workspace_autofix to scan the repository and produce the action plan.",
          "- For targeted structural changes, call agentlint_quick_check with changed paths and/or a short change description before editing any context artifacts.",
          "- Before creating or updating any AGENTS.md, CLAUDE.md, skills, rules, workflows, or plans file, call agentlint_get_guidelines for the artifact type to get the current specification.",
          "- When the user wants ongoing upkeep, use agentlint_emit_maintenance_snippet where supported or append equivalent maintenance instructions to the main project context file.",
          "- Apply recommended context artifact changes directly once Agent Lint has identified what to update.",
          "- Keep context artifact files concise (under 10,000 characters). Reference external docs instead of duplicating content.",
        ].join("\n"),
        "utf-8",
      );

      const result = installMaintenanceRule(getClient("vscode"), tmpDir);
      const finalRaw = fs.readFileSync(targetPath, "utf-8");

      expect(result.status).toBe("updated");
      expect(finalRaw).toContain("# Existing Instructions");
      expect((finalRaw.match(/Agent Lint Context Maintenance/g) ?? [])).toHaveLength(1);
      expect((finalRaw.match(/Treat natural language requests/g) ?? [])).toHaveLength(0);
      expect((finalRaw.match(/Treat plain-English requests/g) ?? [])).toHaveLength(1);
      expect(fs.existsSync(`${targetPath}.bak`)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("is idempotent when the same rule already exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-idempotent-"));

    try {
      const client = getClient("vscode");
      const first = installMaintenanceRule(client, tmpDir);
      const second = installMaintenanceRule(client, tmpDir);

      expect(first.status).toBe("created");
      expect(second.status).toBe("exists");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("treats CRLF files as already configured", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-crlf-"));

    try {
      const client = getClient("vscode");
      const targetPath = path.join(tmpDir, ".github", "copilot-instructions.md");

      installMaintenanceRule(client, tmpDir);
      const raw = fs.readFileSync(targetPath, "utf-8");
      fs.writeFileSync(targetPath, raw.replace(/\r?\n/g, "\r\n"), "utf-8");

      const result = installMaintenanceRule(client, tmpDir);
      const finalRaw = fs.readFileSync(targetPath, "utf-8");

      expect(result.status).toBe("exists");
      expect((finalRaw.match(/plain-English requests/g) ?? [])).toHaveLength(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("updates dedicated Cursor rule files in place", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-rule-update-"));

    try {
      const client = getClient("cursor");
      const targetPath = path.join(tmpDir, ".cursor", "rules", "agentlint-maintenance.mdc");

      installMaintenanceRule(client, tmpDir);
      const raw = fs.readFileSync(targetPath, "utf-8");
      fs.writeFileSync(
        targetPath,
        raw.replace("Agent Lint context maintenance rules", "Older Agent Lint context maintenance rules"),
        "utf-8",
      );

      const result = installMaintenanceRule(client, tmpDir);
      const finalRaw = fs.readFileSync(targetPath, "utf-8");

      expect(result.status).toBe("updated");
      expect((finalRaw.match(/# Scope/g) ?? [])).toHaveLength(1);
      expect(finalRaw).not.toContain("Older Agent Lint context maintenance rules");
      expect(fs.existsSync(`${targetPath}.bak`)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
