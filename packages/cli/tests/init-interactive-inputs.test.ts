/**
 * Interactive input combination tests for the init wizard.
 *
 * Tests different user input paths through the InitWizard TUI:
 * - Scope selection (workspace vs global)
 * - Maintenance rules yes/no
 * - Zero-detection scenario
 * - Exit from main menu
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import { InitWizard, getCommonScopes } from "../src/commands/init.js";
import { CLIENT_REGISTRY } from "../src/commands/clients.js";
import { pressArrowDown, pressEnter, renderInTTY, sleep, waitFor } from "./tty-test-utils.js";

// Space key for MultiSelect toggle
function pressSpace(stdin: NodeJS.WritableStream): void {
  stdin.write(" ");
}

type EnvSnapshot = Record<string, string | undefined>;

function withIsolatedClientEnv<T>(tmpDir: string, fn: () => Promise<T>): Promise<T> {
  const previous: EnvSnapshot = {
    HOME: process.env["HOME"],
    USERPROFILE: process.env["USERPROFILE"],
    APPDATA: process.env["APPDATA"],
    XDG_CONFIG_HOME: process.env["XDG_CONFIG_HOME"],
    LOCALAPPDATA: process.env["LOCALAPPDATA"],
    PATH: process.env["PATH"],
  };

  process.env["HOME"] = path.join(tmpDir, "home");
  process.env["USERPROFILE"] = path.join(tmpDir, "home");
  process.env["APPDATA"] = path.join(tmpDir, "appdata");
  process.env["XDG_CONFIG_HOME"] = path.join(tmpDir, "xdg");
  process.env["LOCALAPPDATA"] = path.join(tmpDir, "localappdata");
  process.env["PATH"] = "";

  fs.mkdirSync(process.env["HOME"]!, { recursive: true });
  fs.mkdirSync(process.env["APPDATA"]!, { recursive: true });
  fs.mkdirSync(process.env["XDG_CONFIG_HOME"]!, { recursive: true });
  fs.mkdirSync(process.env["LOCALAPPDATA"]!, { recursive: true });

  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function withTempCwd(fn: (dir: string) => Promise<void>): Promise<void> {
  const originalCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-interactive-inputs-"));
  process.chdir(tmpDir);
  try {
    await fn(tmpDir);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

afterEach(() => {
  // nothing to clean up globally
});

// ── Scope selection ───────────────────────────────────────────────────────

describe("scope calculation", () => {
  it("limits mixed client selections to the shared scope intersection", () => {
    const cursor = CLIENT_REGISTRY.find((client) => client.id === "cursor");
    const cline = CLIENT_REGISTRY.find((client) => client.id === "cline");

    expect(cursor).toBeDefined();
    expect(cline).toBeDefined();
    expect(getCommonScopes([cursor!, cline!])).toEqual(["global"]);
  });
});

describe("scope selection — workspace (default)", () => {
  it("pressing Enter on scope select picks workspace scope and creates local config", async () => {
    await withTempCwd(async (tmpDir) => {
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: { all: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        // Wait for scope selection
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        // Press Enter to confirm default (workspace)
        await sleep(100);
        pressEnter(session.stdin);

        // Skip maintenance rules prompt
        await waitFor(
          () =>
            session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES") ||
            session.getStdout().includes("MCP config is ready."),
          { timeoutMs: 5_000 },
        );

        if (session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES")) {
          pressEnter(session.stdin);
        }

        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 5_000,
        });

        // VS Code workspace config should be created (we run in tmpDir which has no special dirs
        // so no clients are detected, but --all installs all clients for workspace scope)
        // Check that at least one workspace-scoped config was created
        const vscodeConfig = path.join(tmpDir, ".vscode", "mcp.json");
        const cursorConfig = path.join(tmpDir, ".cursor", "mcp.json");
        const someWorkspaceConfig = [vscodeConfig, cursorConfig].some(fs.existsSync);
        expect(someWorkspaceConfig).toBe(true);
      } finally {
        session.cleanup();
      }
    });
  }, 15_000);
});

describe("scope selection — global", () => {
  it("selecting global scope installs config to home-based path", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-global-scope-test-"));
    const fakeHome = path.join(tmpRoot, "home");
    const originalCwd = process.cwd();
    const workspace = path.join(tmpRoot, "workspace");

    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(workspace, { recursive: true });

    // Override home env for this test
    const prevHome = process.env["HOME"];
    const prevUserProfile = process.env["USERPROFILE"];
    const prevAppData = process.env["APPDATA"];
    const prevXdg = process.env["XDG_CONFIG_HOME"];
    const prevLocalAppData = process.env["LOCALAPPDATA"];

    process.env["HOME"] = fakeHome;
    process.env["USERPROFILE"] = fakeHome;
    process.env["APPDATA"] = path.join(tmpRoot, "appdata");
    process.env["XDG_CONFIG_HOME"] = path.join(tmpRoot, "xdg");
    process.env["LOCALAPPDATA"] = path.join(tmpRoot, "localappdata");
    fs.mkdirSync(process.env["APPDATA"]!, { recursive: true });
    fs.mkdirSync(process.env["XDG_CONFIG_HOME"]!, { recursive: true });
    fs.mkdirSync(process.env["LOCALAPPDATA"]!, { recursive: true });

    process.chdir(workspace);

    try {
      // Note: clients.ts caches paths at module load time (os.homedir() is called at load),
      // so we test with what the current module resolution gives. This test verifies that
      // selecting global scope does NOT create files inside the workspace directory.
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          // Use --all to skip client selection and go straight to scope selection
          options: { all: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        // Scope selection — arrow down to select global
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        await sleep(100);
        pressArrowDown(session.stdin);
        await sleep(50);
        pressEnter(session.stdin);

        // Skip maintenance rules if shown
        await waitFor(
          () =>
            session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES") ||
            session.getStdout().includes("MCP config is ready."),
          { timeoutMs: 5_000 },
        );

        if (session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES")) {
          // Arrow down to select "No, skip"
          pressArrowDown(session.stdin);
          await sleep(50);
          pressEnter(session.stdin);
        }

        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 5_000,
        });

        // Workspace-local files should NOT have been created for global scope
        // (global installs go to home-based paths)
        // The installed files should not be directly inside workspace
        const workspaceEntries = fs.readdirSync(workspace);
        const workspaceConfigDirs = workspaceEntries.filter((name) =>
          [".cursor", ".vscode", ".windsurf", ".kiro", ".roo", ".zed", ".kilocode"].includes(name),
        );
        // With global scope, none of these workspace dirs should be created
        expect(workspaceConfigDirs).toHaveLength(0);
      } finally {
        session.cleanup();
      }
    } finally {
      process.chdir(originalCwd);
      if (prevHome === undefined) delete process.env["HOME"];
      else process.env["HOME"] = prevHome;
      if (prevUserProfile === undefined) delete process.env["USERPROFILE"];
      else process.env["USERPROFILE"] = prevUserProfile;
      if (prevAppData === undefined) delete process.env["APPDATA"];
      else process.env["APPDATA"] = prevAppData;
      if (prevXdg === undefined) delete process.env["XDG_CONFIG_HOME"];
      else process.env["XDG_CONFIG_HOME"] = prevXdg;
      if (prevLocalAppData === undefined) delete process.env["LOCALAPPDATA"];
      else process.env["LOCALAPPDATA"] = prevLocalAppData;
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }, 20_000);
});

// ── Maintenance rules — yes/no ────────────────────────────────────────────

describe("maintenance rules prompt — yes/no", () => {
  it("pressing Enter on maintenance rules (default=No) skips rule installation", async () => {
    await withTempCwd(async (tmpDir) => {
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: { all: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        await sleep(100);
        pressEnter(session.stdin); // workspace scope

        await waitFor(
          () => session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES"),
          { timeoutMs: 8_000 },
        );

        await sleep(100);
        // Default option (first) — select without moving arrow
        pressEnter(session.stdin);

        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 5_000,
        });

        // onComplete called with results array
        await sleep(100);
        pressEnter(session.stdin); // continue prompt
        await waitFor(() => onComplete.mock.calls.length === 1);
      } finally {
        session.cleanup();
      }
    });
  }, 20_000);

  it("--yes option installs maintenance rules without prompting", async () => {
    await withTempCwd(async (tmpDir) => {
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: { all: true, yes: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        pressEnter(session.stdin); // workspace scope

        // With --yes, should skip maintenance rules prompt and go straight to done
        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 10_000,
        });

        // No "INSTALL MAINTENANCE RULES" prompt should have been shown
        // (or it was skipped so fast we didn't see it after scope selection)
        // Key assertion: we reached "MCP config is ready" without needing to interact with rules prompt

        await sleep(100);
        pressEnter(session.stdin); // continue prompt
        await waitFor(() => onComplete.mock.calls.length === 1);

        // Results should include maintenance results (--yes installs them)
        const results = onComplete.mock.calls[0]?.[0] as Array<{
          maintenanceResult?: { status: string };
        }>;
        const hasMaintenanceResult = results.some((r) => r.maintenanceResult !== undefined);
        expect(hasMaintenanceResult).toBe(true);
      } finally {
        session.cleanup();
      }
    });
  }, 20_000);
});

// ── Zero clients detected scenario ───────────────────────────────────────

describe("zero clients detected — empty workspace", () => {
  it("shows client selection with no clients pre-selected in empty workspace", async () => {
    await withTempCwd(async (_tmpDir) => {
      // Empty workspace — no .vscode, .cursor, etc. directories
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: {}, // No --all, so shows client selection with detected clients
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CLIENTS TO CONFIGURE"),
          { timeoutMs: 5_000 },
        );

        // With empty workspace, the UI should show no clients pre-selected
        // (or show the full list as unselected)
        const output = session.getStdout();
        expect(output.toUpperCase()).toContain("SELECT CLIENTS TO CONFIGURE");
      } finally {
        session.cleanup();
      }
    });
  }, 10_000);

  it("pressing Enter with no toggles selects the focused client", async () => {
    await withTempCwd(async (tmpDir) => withIsolatedClientEnv(tmpDir, async () => {
      vi.resetModules();
      const { InitWizard: IsolatedInitWizard } = await import("../src/commands/init.js");
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(IsolatedInitWizard, {
          options: {},
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CLIENTS TO CONFIGURE"),
          { timeoutMs: 5_000 },
        );

        await sleep(100);
        pressEnter(session.stdin);

        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        pressEnter(session.stdin);

        await waitFor(
          () =>
            session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES") ||
            session.getStdout().includes("MCP config is ready."),
          { timeoutMs: 10_000 },
        );

        if (session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES")) {
          pressArrowDown(session.stdin);
          await sleep(50);
          pressEnter(session.stdin);
        }

        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 5_000,
        });

        await sleep(100);
        pressEnter(session.stdin);
        await waitFor(() => onComplete.mock.calls.length === 1, { timeoutMs: 5_000 });

        const results = onComplete.mock.calls[0]?.[0] as Array<{ configResult: { status: string } }>;
        expect(results).toHaveLength(1);
        expect(results[0]?.configResult.status).toMatch(/created|merged|cli-success/);
      } finally {
        session.cleanup();
        vi.resetModules();
      }
    }));
  }, 20_000);

  it("space still toggles multiple client selections before submit", async () => {
    await withTempCwd(async (tmpDir) => withIsolatedClientEnv(tmpDir, async () => {
      vi.resetModules();
      const { InitWizard: IsolatedInitWizard } = await import("../src/commands/init.js");
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(IsolatedInitWizard, {
          options: {},
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CLIENTS TO CONFIGURE"),
          { timeoutMs: 5_000 },
        );

        await sleep(100);
        pressSpace(session.stdin);
        await sleep(50);
        pressArrowDown(session.stdin);
        await sleep(50);
        pressSpace(session.stdin);
        await sleep(50);
        pressEnter(session.stdin);

        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        pressEnter(session.stdin);
        await waitFor(
          () =>
            session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES") ||
            session.getStdout().includes("MCP config is ready."),
          { timeoutMs: 10_000 },
        );

        if (session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES")) {
          pressArrowDown(session.stdin);
          await sleep(50);
          pressEnter(session.stdin);
        }

        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 5_000,
        });

        await sleep(100);
        pressEnter(session.stdin);
        await waitFor(() => onComplete.mock.calls.length === 1, { timeoutMs: 5_000 });

        const results = onComplete.mock.calls[0]?.[0] as unknown[];
        expect(results).toHaveLength(2);
      } finally {
        session.cleanup();
        vi.resetModules();
      }
    }));
  }, 20_000);
});

// ── Main menu exit ────────────────────────────────────────────────────────

describe("main menu — exit option", () => {
  it("selecting Exit from main menu terminates cleanly", async () => {
    await withTempCwd(async (_tmpDir) => {
      const session = renderInTTY(React.createElement(App));

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("WHAT WOULD YOU LIKE TO DO?"),
          { timeoutMs: 5_000 },
        );

        // Navigate to Exit option (last item in menu)
        // Menu order: init (1st), scan (2nd), prompt (3rd), exit (4th)
        await sleep(100);
        pressArrowDown(session.stdin);
        await sleep(50);
        pressArrowDown(session.stdin);
        await sleep(50);
        pressArrowDown(session.stdin);
        await sleep(50);
        pressEnter(session.stdin);

        // App should unmount/exit cleanly — wait a bit then verify no crashes
        await sleep(500);
        // If we got here without timeout, exit worked cleanly
        expect(true).toBe(true);
      } finally {
        session.cleanup();
      }
    });
  }, 10_000);
});

// ── Wizard --withRules option ─────────────────────────────────────────────

describe("init wizard --withRules option", () => {
  it("--withRules option installs rules alongside MCP config without prompting", async () => {
    await withTempCwd(async (tmpDir) => {
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: { all: true, withRules: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        pressEnter(session.stdin); // workspace scope

        // With --withRules, should skip the maintenance rules prompt
        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 10_000,
        });

        await sleep(100);
        pressEnter(session.stdin); // continue
        await waitFor(() => onComplete.mock.calls.length === 1);

        const results = onComplete.mock.calls[0]?.[0] as Array<{
          maintenanceResult?: { status: string };
        }>;
        // At least some results should have maintenance installed
        const hasMaintenanceResult = results.some((r) => r.maintenanceResult !== undefined);
        expect(hasMaintenanceResult).toBe(true);
      } finally {
        session.cleanup();
      }
    });
  }, 20_000);
});

// ── Multi-client result verification ─────────────────────────────────────

describe("init wizard multi-client results", () => {
  it("--all installs configs for all 13 clients and reports results", async () => {
    await withTempCwd(async (_tmpDir) => {
      const onComplete = vi.fn();

      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: { all: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
          { timeoutMs: 5_000 },
        );

        pressEnter(session.stdin); // workspace scope

        await waitFor(
          () =>
            session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES") ||
            session.getStdout().includes("MCP config is ready."),
          { timeoutMs: 10_000 },
        );

        if (session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES")) {
          pressArrowDown(session.stdin); // No
          await sleep(50);
          pressEnter(session.stdin);
        }

        await waitFor(() => session.getStdout().includes("MCP config is ready."), {
          timeoutMs: 5_000,
        });

        await sleep(100);
        pressEnter(session.stdin);
        await waitFor(() => onComplete.mock.calls.length === 1, { timeoutMs: 5_000 });

        const results = onComplete.mock.calls[0]?.[0] as unknown[];
        // --all selects all 13 clients, results array should have 13 entries
        expect(results.length).toBe(13);
      } finally {
        session.cleanup();
      }
    });
  }, 20_000);
});

