import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

async function loadModules() {
  vi.resetModules();
  const clients = await import("../src/commands/clients.js");
  const writer = await import("../src/commands/config-writer.js");
  return { ...clients, ...writer };
}

describe("installClient CLI integration", () => {
  beforeEach(() => {
    execFileSyncMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("uses the official Claude Code CLI flow when preferred", async () => {
    execFileSyncMock.mockReturnValue("");
    const { CLIENT_REGISTRY, installClient } = await loadModules();
    const claudeCode = CLIENT_REGISTRY.find((client) => client.id === "claude-code");

    expect(claudeCode).toBeDefined();

    const result = installClient(claudeCode!, "workspace", process.cwd(), true);

    expect(result.status).toBe("cli-success");
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);

    const [binary, args, options] = execFileSyncMock.mock.calls[0] as [string, string[], Record<string, unknown>];
    expect(binary).toBe("claude");
    expect(args).toContain("mcp");
    expect(args).toContain("add");
    expect(args).toContain("--transport");
    expect(args).toContain("stdio");
    expect(args).toContain("--scope");
    expect(args).toContain("project");
    expect(args).toContain("agentlint");
    expect(args).toContain("--");
    expect(options.timeout).toBe(15_000);
  });

  it("falls back to file merge when the Claude Code CLI install fails", async () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("cli unavailable");
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-claude-fallback-"));

    try {
      const { CLIENT_REGISTRY, installClient } = await loadModules();
      const claudeCode = CLIENT_REGISTRY.find((client) => client.id === "claude-code");

      expect(claudeCode).toBeDefined();

      const result = installClient(claudeCode!, "workspace", tmpDir, true);

      expect(result.status).toBe("created");
      if (result.status === "created") {
        expect(result.configPath.replace(/\\/g, "/")).toBe(`${tmpDir.replace(/\\/g, "/")}/.mcp.json`);
        expect(JSON.parse(fs.readFileSync(result.configPath, "utf-8"))).toHaveProperty("mcpServers.agentlint");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
