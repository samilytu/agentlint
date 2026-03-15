import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildServerEntry,
  CLIENT_REGISTRY,
  detectInstalledClients,
  type McpClient,
  type ClientId,
  getDefaultSelectedClientIds,
  getAvailableScopes,
  resolveConfigPath,
} from "../src/commands/clients.js";

// ── Helpers ─────────────────────────────────────────────────────────────

/** Create a minimal McpClient stub for a given client id */
function stubClient(id: ClientId, overrides?: Partial<McpClient>): McpClient {
  return {
    id,
    name: id,
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {},
    detectBinaries: [],
    detectDirs: [],
    detectPaths: [],
    detectExtensionPrefixes: [],
    ...overrides,
  };
}

function slash(input: string): string {
  return input.replace(/\\/g, "/");
}

// ── buildServerEntry ────────────────────────────────────────────────────

describe("buildServerEntry", () => {
  it("returns stdio entry with type for vscode", () => {
    const entry = buildServerEntry(stubClient("vscode", { rootKey: "servers" }));
    expect(entry).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns zed-specific structure with command.path", () => {
    const entry = buildServerEntry(stubClient("zed", { rootKey: "context_servers" }));
    expect(entry).toEqual({
      command: { path: "npx", args: ["-y", "@agent-lint/mcp"] },
      settings: {},
    });
  });

  it("returns opencode-specific structure with type local", () => {
    const entry = buildServerEntry(stubClient("opencode", { rootKey: "mcp" }));
    expect(entry).toEqual({
      type: "local",
      command: ["npx", "-y", "@agent-lint/mcp"],
      enabled: true,
    });
  });

  it("returns flat command/args for codex (TOML)", () => {
    const entry = buildServerEntry(stubClient("codex", { configFormat: "toml", rootKey: "mcp_servers" }));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for cursor", () => {
    const entry = buildServerEntry(stubClient("cursor"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for windsurf", () => {
    const entry = buildServerEntry(stubClient("windsurf"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for claude-desktop", () => {
    const entry = buildServerEntry(stubClient("claude-desktop"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for claude-code", () => {
    const entry = buildServerEntry(stubClient("claude-code"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for cline", () => {
    const entry = buildServerEntry(stubClient("cline"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for kiro", () => {
    const entry = buildServerEntry(stubClient("kiro"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for kilo-code", () => {
    const entry = buildServerEntry(stubClient("kilo-code"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for roo-code", () => {
    const entry = buildServerEntry(stubClient("roo-code"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("returns default stdio entry for antigravity", () => {
    const entry = buildServerEntry(stubClient("antigravity"));
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@agent-lint/mcp"],
    });
  });

  it("never includes rootKey wrapper in returned entry", () => {
    for (const client of CLIENT_REGISTRY) {
      const entry = buildServerEntry(client);
      // The entry must NOT contain the rootKey as a top-level key
      // (that's what the removed buildMcpPayload used to do)
      expect(entry).not.toHaveProperty(client.rootKey);
    }
  });

  it("returns fresh objects on each call (no mutation risk)", () => {
    const client = stubClient("cursor");
    const a = buildServerEntry(client);
    const b = buildServerEntry(client);
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // different references
  });

  it("covers every client in CLIENT_REGISTRY without throwing", () => {
    for (const client of CLIENT_REGISTRY) {
      expect(() => buildServerEntry(client)).not.toThrow();
      const entry = buildServerEntry(client);
      expect(entry).toBeDefined();
      expect(typeof entry).toBe("object");
    }
  });
});

describe("getDefaultSelectedClientIds", () => {
  it("preselects clients detected from workspace directories", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-clients-"));
    fs.mkdirSync(path.join(cwd, ".cursor"));

    const selected = getDefaultSelectedClientIds([
      { client: stubClient("cursor", { detectDirs: [".cursor"] }), detectedBy: "binary" },
      { client: stubClient("vscode", { detectDirs: [".vscode"] }), detectedBy: "binary" },
    ], cwd);

    expect(selected).toEqual(["cursor"]);

    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("preselects clients with existing config files", () => {
    const selected = getDefaultSelectedClientIds([
      { client: stubClient("claude-desktop"), detectedBy: "config-exists" },
    ], process.cwd());

    expect(selected).toEqual(["claude-desktop"]);
  });

  it("preselects extension-detected clients", () => {
    const selected = getDefaultSelectedClientIds([
      { client: stubClient("roo-code"), detectedBy: "extension" },
    ], process.cwd());

    expect(selected).toEqual(["roo-code"]);
  });

  it("does not preselect binary-only detections", () => {
    const selected = getDefaultSelectedClientIds([
      { client: stubClient("codex"), detectedBy: "binary" },
      { client: stubClient("windsurf"), detectedBy: "binary" },
    ], process.cwd());

    expect(selected).toEqual([]);
  });

  it("preselects clients detected from workspace files", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-client-paths-"));

    try {
      fs.mkdirSync(path.join(cwd, ".roo"), { recursive: true });
      fs.writeFileSync(path.join(cwd, ".roo", "mcp.json"), "{}", "utf-8");

      const selected = getDefaultSelectedClientIds([
        { client: stubClient("roo-code", { detectPaths: [".roo/mcp.json"] }), detectedBy: "directory" },
      ], cwd);

      expect(selected).toEqual(["roo-code"]);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("detectInstalledClients", () => {
  it("detects workspace-configured Roo Code, Kilo Code, and Kiro clients", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-detect-clients-"));

    try {
      fs.mkdirSync(path.join(cwd, ".roo"), { recursive: true });
      fs.mkdirSync(path.join(cwd, ".kilocode"), { recursive: true });
      fs.mkdirSync(path.join(cwd, ".kiro", "settings"), { recursive: true });
      fs.writeFileSync(path.join(cwd, ".roo", "mcp.json"), "{}", "utf-8");
      fs.writeFileSync(path.join(cwd, ".kilocode", "mcp.json"), "{}", "utf-8");
      fs.writeFileSync(path.join(cwd, ".kiro", "settings", "mcp.json"), "{}", "utf-8");

      const detectedIds = detectInstalledClients(cwd).map((entry) => entry.client.id);

      expect(detectedIds).toContain("roo-code");
      expect(detectedIds).toContain("kilo-code");
      expect(detectedIds).toContain("kiro");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("detects Roo Code, Kilo Code, and Cline from VS Code extension installs", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-detect-ext-"));
    const previousHome = process.env["HOME"];
    const previousUserProfile = process.env["USERPROFILE"];

    try {
      process.env["HOME"] = tmpRoot;
      process.env["USERPROFILE"] = tmpRoot;
      const extensionsDir = path.join(tmpRoot, ".vscode", "extensions");
      fs.mkdirSync(path.join(extensionsDir, "rooveterinaryinc.roo-cline-1.0.0"), { recursive: true });
      fs.mkdirSync(path.join(extensionsDir, "kilocode.kilo-code-1.0.0"), { recursive: true });
      fs.mkdirSync(path.join(extensionsDir, "saoudrizwan.claude-dev-1.0.0"), { recursive: true });

      vi.resetModules();
      const reloadedClients = await import("../src/commands/clients.js");
      const detectedIds = reloadedClients.detectInstalledClients(process.cwd()).map((entry) => entry.client.id);

      expect(detectedIds).toContain("roo-code");
      expect(detectedIds).toContain("kilo-code");
      expect(detectedIds).toContain("cline");
    } finally {
      if (previousHome === undefined) {
        delete process.env["HOME"];
      } else {
        process.env["HOME"] = previousHome;
      }
      if (previousUserProfile === undefined) {
        delete process.env["USERPROFILE"];
      } else {
        process.env["USERPROFILE"] = previousUserProfile;
      }
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      vi.resetModules();
    }
  });
});

describe("CLIENT_REGISTRY", () => {
  it("matches the requested client order", () => {
    expect(CLIENT_REGISTRY.map((client) => client.id)).toEqual([
      "claude-code",
      "codex",
      "cursor",
      "opencode",
      "windsurf",
      "claude-desktop",
      "vscode",
      "kilo-code",
      "cline",
      "roo-code",
      "kiro",
      "zed",
      "antigravity",
    ]);
  });

  it("exposes the intended scope support for corrected and new clients", () => {
    const scopesById = Object.fromEntries(
      CLIENT_REGISTRY.map((client) => [client.id, getAvailableScopes(client)]),
    );

    expect(scopesById["claude-code"]).toEqual(["workspace", "global"]);
    expect(scopesById["kilo-code"]).toEqual(["workspace", "global"]);
    expect(scopesById["roo-code"]).toEqual(["workspace", "global"]);
    expect(scopesById["kiro"]).toEqual(["workspace", "global"]);
    expect(scopesById["cline"]).toEqual(["global"]);
    expect(scopesById["antigravity"]).toEqual(["global"]);
  });
});

describe("resolveConfigPath", () => {
  it("resolves the updated Claude Code paths", () => {
    const cwd = "/workspace";
    const client = CLIENT_REGISTRY.find((entry) => entry.id === "claude-code");

    expect(client).toBeDefined();
    expect(slash(resolveConfigPath(client!, "workspace", cwd)!)).toBe("/workspace/.mcp.json");
    expect(slash(resolveConfigPath(client!, "global", cwd)!)).toMatch(/\.claude\.json$/);
  });

  it("resolves Roo Code, Kilo Code, and Kiro MCP files", () => {
    const cwd = "/workspace";
    const kilo = CLIENT_REGISTRY.find((entry) => entry.id === "kilo-code");
    const roo = CLIENT_REGISTRY.find((entry) => entry.id === "roo-code");
    const kiro = CLIENT_REGISTRY.find((entry) => entry.id === "kiro");

    expect(kilo).toBeDefined();
    expect(roo).toBeDefined();
    expect(kiro).toBeDefined();

    expect(slash(resolveConfigPath(kilo!, "workspace", cwd)!)).toBe("/workspace/.kilocode/mcp.json");
    expect(slash(resolveConfigPath(roo!, "workspace", cwd)!)).toBe("/workspace/.roo/mcp.json");
    expect(slash(resolveConfigPath(kiro!, "workspace", cwd)!)).toBe("/workspace/.kiro/settings/mcp.json");

    expect(slash(resolveConfigPath(kilo!, "global", cwd)!)).toMatch(/\/kilo(\/|\\)kilo\.json$/);
    expect(slash(resolveConfigPath(roo!, "global", cwd)!)).toContain("/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json");
    expect(slash(resolveConfigPath(kiro!, "global", cwd)!)).toMatch(/\.kiro\/settings\/mcp\.json$/);
  });
});
