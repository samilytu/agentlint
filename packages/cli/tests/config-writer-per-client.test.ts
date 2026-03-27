/**
 * Per-client config writer tests.
 *
 * Validates server entry structure, idempotency, merge-with-existing,
 * backup creation, corrupted config handling, scope path resolution,
 * and global-only scope enforcement for all 13 supported MCP clients.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

function setTempHomeEnv(tmpRoot: string): EnvSnapshot {
  const previous: EnvSnapshot = {
    HOME: process.env["HOME"],
    USERPROFILE: process.env["USERPROFILE"],
    APPDATA: process.env["APPDATA"],
    XDG_CONFIG_HOME: process.env["XDG_CONFIG_HOME"],
    LOCALAPPDATA: process.env["LOCALAPPDATA"],
  };

  process.env["HOME"] = path.join(tmpRoot, "home");
  process.env["USERPROFILE"] = path.join(tmpRoot, "home");
  process.env["APPDATA"] = path.join(tmpRoot, "appdata");
  process.env["XDG_CONFIG_HOME"] = path.join(tmpRoot, "xdg");
  process.env["LOCALAPPDATA"] = path.join(tmpRoot, "localappdata");

  fs.mkdirSync(process.env["HOME"]!, { recursive: true });
  fs.mkdirSync(process.env["APPDATA"]!, { recursive: true });
  fs.mkdirSync(process.env["XDG_CONFIG_HOME"]!, { recursive: true });
  fs.mkdirSync(process.env["LOCALAPPDATA"]!, { recursive: true });

  return previous;
}

function restoreEnv(previous: EnvSnapshot): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadCliModules() {
  vi.resetModules();
  const clients = await import("../src/commands/clients.js");
  const writer = await import("../src/commands/config-writer.js");
  return { ...clients, ...writer };
}

afterEach(() => {
  vi.resetModules();
});

// ── Server entry structure tests ─────────────────────────────────────────

describe("buildServerEntry — client-specific server entry shapes", () => {
  it("default clients return stdio entry (command + args)", async () => {
    const { CLIENT_REGISTRY, buildServerEntry } = await loadCliModules();
    const defaultIds = [
      "claude-code", "cursor", "windsurf", "claude-desktop",
      "kilo-code", "cline", "roo-code", "kiro", "antigravity",
    ];
    for (const id of defaultIds) {
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === id)!;
      expect(client).toBeDefined();
      const entry = buildServerEntry(client);
      expect(entry).toHaveProperty("command", "npx");
      expect(entry).toHaveProperty("args");
      expect(entry.args).toContain("-y");
      expect(entry.args).toContain("@agent-lint/mcp");
    }
  });

  it("vscode returns stdio entry with type field", async () => {
    const { CLIENT_REGISTRY, buildServerEntry } = await loadCliModules();
    const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "vscode")!;
    const entry = buildServerEntry(client);
    expect(entry).toHaveProperty("type", "stdio");
    expect(entry).toHaveProperty("command", "npx");
    expect(Array.isArray(entry.args)).toBe(true);
  });

  it("zed returns nested command.path structure", async () => {
    const { CLIENT_REGISTRY, buildServerEntry } = await loadCliModules();
    const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "zed")!;
    const entry = buildServerEntry(client);
    expect(entry).toHaveProperty("command");
    expect(entry.command).toHaveProperty("path", "npx");
    expect((entry.command as Record<string, unknown>).args).toContain("-y");
    expect((entry.command as Record<string, unknown>).args).toContain("@agent-lint/mcp");
    expect(entry).toHaveProperty("settings");
  });

  it("opencode returns local type with command array and enabled flag", async () => {
    const { CLIENT_REGISTRY, buildServerEntry } = await loadCliModules();
    const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "opencode")!;
    const entry = buildServerEntry(client);
    expect(entry).toHaveProperty("type", "local");
    expect(Array.isArray(entry.command)).toBe(true);
    expect(entry.command).toContain("npx");
    expect(entry.command).toContain("-y");
    expect(entry.command).toContain("@agent-lint/mcp");
    expect(entry).toHaveProperty("enabled", true);
  });

  it("codex returns TOML-compatible entry (command + args)", async () => {
    const { CLIENT_REGISTRY, buildServerEntry } = await loadCliModules();
    const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;
    const entry = buildServerEntry(client);
    expect(entry).toHaveProperty("command", "npx");
    expect(Array.isArray(entry.args)).toBe(true);
  });
});

// ── Workspace scope path tests ────────────────────────────────────────────

describe("workspace scope — config created at correct relative path", () => {
  const workspaceScopedClients: Array<{
    id: string;
    expectedRelativePath: string;
    rootKey: string;
  }> = [
    { id: "claude-code", expectedRelativePath: ".mcp.json", rootKey: "mcpServers" },
    { id: "codex", expectedRelativePath: ".codex/config.toml", rootKey: "mcp_servers" },
    { id: "cursor", expectedRelativePath: ".cursor/mcp.json", rootKey: "mcpServers" },
    { id: "opencode", expectedRelativePath: "opencode.json", rootKey: "mcp" },
    { id: "windsurf", expectedRelativePath: ".windsurf/mcp_config.json", rootKey: "mcpServers" },
    { id: "vscode", expectedRelativePath: ".vscode/mcp.json", rootKey: "servers" },
    { id: "kilo-code", expectedRelativePath: ".kilocode/mcp.json", rootKey: "mcpServers" },
    { id: "roo-code", expectedRelativePath: ".roo/mcp.json", rootKey: "mcpServers" },
    { id: "kiro", expectedRelativePath: ".kiro/settings/mcp.json", rootKey: "mcpServers" },
    { id: "zed", expectedRelativePath: ".zed/settings.json", rootKey: "context_servers" },
  ];

  for (const { id, expectedRelativePath, rootKey } of workspaceScopedClients) {
    it(`${id} — creates config at cwd/${expectedRelativePath}`, async () => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `agentlint-ws-${id}-`));
      const prevEnv = setTempHomeEnv(tmpRoot);
      const workspace = path.join(tmpRoot, "workspace");
      fs.mkdirSync(workspace, { recursive: true });

      try {
        const { CLIENT_REGISTRY, installClient } = await loadCliModules();
        const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === id)!;
        expect(client).toBeDefined();

        const result = installClient(client, "workspace", workspace, false);

        expect(result.status).toBe("created");
        if (result.status !== "created") return;

        const expectedPath = path.join(workspace, expectedRelativePath);
        expect(result.configPath.replace(/\\/g, "/")).toBe(expectedPath.replace(/\\/g, "/"));
        expect(fs.existsSync(result.configPath)).toBe(true);

        // Verify agentlint key exists under the correct rootKey
        const raw = fs.readFileSync(result.configPath, "utf-8");
        const parsed = id === "codex"
          ? (parseToml(raw) as Record<string, unknown>)
          : (JSON.parse(raw) as Record<string, unknown>);

        expect(parsed).toHaveProperty(rootKey);
        expect((parsed[rootKey] as Record<string, unknown>)).toHaveProperty("agentlint");
      } finally {
        restoreEnv(prevEnv);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  }
});

// ── Global-only clients reject workspace scope ────────────────────────────

describe("global-only clients — reject workspace scope", () => {
  const globalOnlyIds = ["claude-desktop", "cline", "antigravity"];

  for (const id of globalOnlyIds) {
    it(`${id} returns 'no-scope' for workspace scope`, async () => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `agentlint-noscope-${id}-`));
      const prevEnv = setTempHomeEnv(tmpRoot);
      const workspace = path.join(tmpRoot, "workspace");
      fs.mkdirSync(workspace, { recursive: true });

      try {
        const { CLIENT_REGISTRY, installClient } = await loadCliModules();
        const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === id)!;
        expect(client).toBeDefined();

        const result = installClient(client, "workspace", workspace, false);
        expect(result.status).toBe("no-scope");
        if (result.status === "no-scope") {
          expect(result.message).toContain(client.name);
          expect(result.message.toLowerCase()).toContain("workspace");
        }
      } finally {
        restoreEnv(prevEnv);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  }
});

// ── Global scope path tests ───────────────────────────────────────────────

describe("global scope — config created at home-based path", () => {
  it("claude-code global uses ~/.claude.json", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-global-cc-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "claude-code")!;
      const result = installClient(client, "global", workspace, false);

      expect(result.status).toBe("created");
      if (result.status !== "created") return;
      // Should be inside our fake home dir, not cwd
      expect(result.configPath).toContain(path.join(tmpRoot, "home"));
      expect(result.configPath).toContain(".claude.json");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("cursor global uses ~/.cursor/mcp.json", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-global-cursor-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;
      const result = installClient(client, "global", workspace, false);

      expect(result.status).toBe("created");
      if (result.status !== "created") return;
      expect(result.configPath).toContain(path.join(tmpRoot, "home"));
      expect(result.configPath.replace(/\\/g, "/")).toContain(".cursor/mcp.json");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("codex global uses ~/.codex/config.toml", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-global-codex-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;
      const result = installClient(client, "global", workspace, false);

      expect(result.status).toBe("created");
      if (result.status !== "created") return;
      expect(result.configPath).toContain(path.join(tmpRoot, "home"));
      expect(result.configPath.replace(/\\/g, "/")).toContain(".codex/config.toml");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("kilo-code global uses VS Code global storage mcp_settings.json", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-global-kilo-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "kilo-code")!;
      const result = installClient(client, "global", workspace, false);

      expect(result.status).toBe("created");
      if (result.status !== "created") return;
      expect(result.configPath.replace(/\\/g, "/")).toContain(
        "Code/User/globalStorage/kilocode.kilo-code/settings/mcp_settings.json",
      );
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("antigravity global uses ~/.gemini/antigravity/mcp_config.json", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-global-ag-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "antigravity")!;
      const result = installClient(client, "global", workspace, false);

      expect(result.status).toBe("created");
      if (result.status !== "created") return;
      expect(result.configPath).toContain(path.join(tmpRoot, "home"));
      expect(result.configPath.replace(/\\/g, "/")).toContain(".gemini/antigravity/mcp_config.json");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────

describe("idempotency — second install returns 'exists'", () => {
  it("JSON client (cursor) returns 'exists' on second call", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-idempotent-cursor-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;

      const first = installClient(client, "workspace", workspace, false);
      expect(first.status).toBe("created");

      const second = installClient(client, "workspace", workspace, false);
      expect(second.status).toBe("exists");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("TOML client (codex) returns 'exists' on second call", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-idempotent-codex-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;

      const first = installClient(client, "workspace", workspace, false);
      expect(first.status).toBe("created");

      const second = installClient(client, "workspace", workspace, false);
      expect(second.status).toBe("exists");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("vscode returns 'exists' on second call", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-idempotent-vscode-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "vscode")!;

      const first = installClient(client, "workspace", workspace, false);
      expect(first.status).toBe("created");

      const second = installClient(client, "workspace", workspace, false);
      expect(second.status).toBe("exists");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe("stale agentlint entries — repair in place", () => {
  it("updates a stale JSON agentlint entry and creates a backup", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-update-json-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((entry: { id: string }) => entry.id === "cursor")!;
      const configPath = path.join(workspace, ".cursor", "mcp.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({ mcpServers: { agentlint: { command: "node", args: ["legacy"] } } }, null, 2),
        "utf-8",
      );

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("updated");

      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        mcpServers: { agentlint: { command: string; args: string[] } };
      };
      expect(parsed.mcpServers.agentlint.command).toBe("npx");
      expect(parsed.mcpServers.agentlint.args).toEqual(["-y", "@agent-lint/mcp"]);
      expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("updates a stale TOML agentlint entry and creates a backup", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-update-toml-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((entry: { id: string }) => entry.id === "codex")!;
      const configPath = path.join(workspace, ".codex", "config.toml");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        '[mcp_servers.agentlint]\ncommand = "node"\nargs = ["legacy"]\n',
        "utf-8",
      );

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("updated");

      const parsed = parseToml(fs.readFileSync(configPath, "utf-8")) as {
        mcp_servers: { agentlint: { command: string; args: string[] } };
      };
      expect(parsed.mcp_servers.agentlint.command).toBe("npx");
      expect(parsed.mcp_servers.agentlint.args).toEqual(["-y", "@agent-lint/mcp"]);
      expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ── Merge with existing config ────────────────────────────────────────────

describe("merge — existing servers are preserved", () => {
  it("JSON client (cursor) keeps pre-existing servers after merge", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-merge-cursor-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;

      // Pre-populate with an existing server
      const configPath = path.join(workspace, ".cursor", "mcp.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({ mcpServers: { "other-server": { command: "other", args: [] } } }, null, 2),
        "utf-8",
      );

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        mcpServers: Record<string, unknown>;
      };
      // Both servers present
      expect(parsed.mcpServers).toHaveProperty("agentlint");
      expect(parsed.mcpServers).toHaveProperty("other-server");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("TOML client (codex) keeps pre-existing servers after merge", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-merge-codex-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;

      // Pre-populate with an existing TOML server
      const configPath = path.join(workspace, ".codex", "config.toml");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        '[mcp_servers.other-tool]\ncommand = "other"\nargs = []\n',
        "utf-8",
      );

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      const parsed = parseToml(fs.readFileSync(configPath, "utf-8")) as {
        mcp_servers: Record<string, unknown>;
      };
      expect(parsed.mcp_servers).toHaveProperty("agentlint");
      expect(parsed.mcp_servers).toHaveProperty("other-tool");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("opencode keeps pre-existing servers after merge", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-merge-opencode-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "opencode")!;

      const configPath = path.join(workspace, "opencode.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({ mcp: { "existing-server": { type: "local", command: ["other"], enabled: true } } }, null, 2),
        "utf-8",
      );

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        mcp: Record<string, unknown>;
      };
      expect(parsed.mcp).toHaveProperty("agentlint");
      expect(parsed.mcp).toHaveProperty("existing-server");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ── Backup creation ───────────────────────────────────────────────────────

describe("backup — .bak file created when merging into existing config", () => {
  it("creates .bak file when merging JSON config", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-backup-json-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;

      const configPath = path.join(workspace, ".cursor", "mcp.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const original = JSON.stringify({ mcpServers: { "existing": { command: "foo" } } }, null, 2);
      fs.writeFileSync(configPath, original, "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      // Backup file should exist
      const backupPath = `${configPath}.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);
      // Backup should contain original content
      expect(fs.readFileSync(backupPath, "utf-8")).toBe(original);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("creates .bak file when merging TOML config (codex)", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-backup-toml-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;

      const configPath = path.join(workspace, ".codex", "config.toml");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const original = '[mcp_servers.existing]\ncommand = "foo"\nargs = []\n';
      fs.writeFileSync(configPath, original, "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      const backupPath = `${configPath}.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.readFileSync(backupPath, "utf-8")).toBe(original);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("does NOT create .bak file when creating a new config", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-no-backup-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("created");
      if (result.status !== "created") return;

      const backupPath = `${result.configPath}.bak`;
      expect(fs.existsSync(backupPath)).toBe(false);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ── Corrupted config handling ─────────────────────────────────────────────

describe("corrupted config — returns 'error' status", () => {
  it("returns 'error' for corrupted JSON config", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-corrupt-json-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;

      const configPath = path.join(workspace, ".cursor", "mcp.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, "{ this is not valid json {{{{", "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message.toLowerCase()).toContain("json");
      }
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("returns 'error' for corrupted TOML config (codex)", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-corrupt-toml-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;

      const configPath = path.join(workspace, ".codex", "config.toml");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, "[invalid toml @@@ ===\n   broken = \"{{{{", "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message.toLowerCase()).toContain("toml");
      }
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("returns 'error' when rootKey exists but is not an object", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-corrupt-rootkey-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "vscode")!;

      const configPath = path.join(workspace, ".vscode", "mcp.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      // rootKey "servers" is a string instead of object
      fs.writeFileSync(configPath, JSON.stringify({ servers: "not-an-object" }, null, 2), "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message).toContain('"servers"');
      }
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("treats an empty existing JSON config as mergeable", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-empty-json-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "cursor")!;

      const configPath = path.join(workspace, ".cursor", "mcp.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, "", "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        mcpServers: Record<string, unknown>;
      };
      expect(parsed.mcpServers).toHaveProperty("agentlint");
      expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("treats an empty existing TOML config as mergeable", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-empty-toml-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;

      const configPath = path.join(workspace, ".codex", "config.toml");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, "", "utf-8");

      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("merged");

      const parsed = parseToml(fs.readFileSync(configPath, "utf-8")) as {
        mcp_servers: Record<string, unknown>;
      };
      expect(parsed.mcp_servers).toHaveProperty("agentlint");
      expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ── Server entry content validation ──────────────────────────────────────

describe("installed config content — server entry structure in file", () => {
  it("vscode config contains type:'stdio' in the entry", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-content-vscode-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "vscode")!;
      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("created");
      if (result.status !== "created") return;

      const parsed = JSON.parse(fs.readFileSync(result.configPath, "utf-8")) as {
        servers: { agentlint: { type: string } };
      };
      expect(parsed.servers.agentlint).toHaveProperty("type", "stdio");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("zed config contains nested command.path in the entry", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-content-zed-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "zed")!;
      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("created");
      if (result.status !== "created") return;

      const parsed = JSON.parse(fs.readFileSync(result.configPath, "utf-8")) as {
        context_servers: { agentlint: { command: { path: string } } };
      };
      expect(parsed.context_servers.agentlint.command).toHaveProperty("path", "npx");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("opencode config contains type:'local' and enabled:true in the entry", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-content-opencode-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "opencode")!;
      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("created");
      if (result.status !== "created") return;

      const parsed = JSON.parse(fs.readFileSync(result.configPath, "utf-8")) as {
        mcp: { agentlint: { type: string; enabled: boolean } };
      };
      expect(parsed.mcp.agentlint).toHaveProperty("type", "local");
      expect(parsed.mcp.agentlint).toHaveProperty("enabled", true);
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("codex TOML config is valid TOML with mcp_servers.agentlint key", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-content-codex-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, installClient } = await loadCliModules();
      const client = CLIENT_REGISTRY.find((c: { id: string }) => c.id === "codex")!;
      const result = installClient(client, "workspace", workspace, false);
      expect(result.status).toBe("created");
      if (result.status !== "created") return;

      const raw = fs.readFileSync(result.configPath, "utf-8");
      // Should be valid TOML
      const parsed = parseToml(raw) as { mcp_servers: Record<string, unknown> };
      expect(parsed.mcp_servers).toHaveProperty("agentlint");
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ── All 13 clients smoke test ─────────────────────────────────────────────

describe("all 13 clients — basic install smoke test", () => {
  it("installs successfully for all clients in their first available scope", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-allclients-"));
    const prevEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const { CLIENT_REGISTRY, getAvailableScopes, installClient } = await loadCliModules();

      for (const client of CLIENT_REGISTRY) {
        const scopes = getAvailableScopes(client);
        expect(scopes.length).toBeGreaterThan(0);

        const scope = scopes[0]!;
        const result = installClient(client, scope, workspace, false);

        expect(["created", "merged", "exists"]).toContain(result.status);
        if ("configPath" in result) {
          expect(fs.existsSync(result.configPath)).toBe(true);
        }
      }
    } finally {
      restoreEnv(prevEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
