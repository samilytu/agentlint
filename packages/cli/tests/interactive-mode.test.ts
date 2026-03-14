import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { pressArrowDown, pressEnter, renderInTTY, sleep, waitFor } from "./tty-test-utils.js";

const ROOT = path.resolve(__dirname, "../../..");
const TSX_PATH = path.resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SOURCE_CLI_PATH = path.resolve(ROOT, "packages", "cli", "src", "index.tsx");

function run(args: string[], cwd?: string): string {
  return execFileSync(process.execPath, [TSX_PATH, SOURCE_CLI_PATH, ...args], {
    cwd: cwd ?? ROOT,
    encoding: "utf-8",
    timeout: 10_000,
  });
}

function runCli(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [TSX_PATH, SOURCE_CLI_PATH, ...args], {
    cwd: cwd ?? ROOT,
    encoding: "utf-8",
    timeout: 10_000,
  });
}

describe("Bare invocation routing", () => {
  it("prints help instead of launching TUI when stdin is not a TTY", () => {
    const result = runCli([]);
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const combined = `${stdout}${stderr}`;

    expect(result.status).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("init");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("prompt");
    expect(combined).not.toContain("Raw mode is not supported");
  });

  it("treats bare '--' as a help fallback in non-TTY mode", () => {
    const result = runCli(["--"]);
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const combined = `${stdout}${stderr}`;

    expect(result.status).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("Set up Agent Lint MCP config");
    expect(combined).not.toContain("Raw mode is not supported");
  });
});

describe("Interactive TTY flow", () => {
  it("keeps embedded init results visible until the user confirms", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-interactive-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));
    process.chdir(tmpDir);

    const session = renderInTTY(React.createElement(App));

    try {
      await waitFor(() => session.getStdout().toUpperCase().includes("WHAT WOULD YOU LIKE TO DO?"));

      await sleep(100);
      pressEnter(session.stdin);
      await waitFor(() => session.getStdout().toUpperCase().includes("SELECT CLIENTS TO CONFIGURE"));

      await sleep(100);
      pressEnter(session.stdin);
      await waitFor(() => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"));

      await sleep(100);
      pressEnter(session.stdin);

      await waitFor(() => session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES"), {
        timeoutMs: 10_000,
      });

      await sleep(100);
      pressEnter(session.stdin);

      await waitFor(() => session.getStdout().includes("MCP config is ready."), {
        timeoutMs: 10_000,
      });

      await sleep(350);
      expect(session.getStdout().toUpperCase()).not.toContain("WHAT'S NEXT?");

      pressEnter(session.stdin);

      await waitFor(() => session.getStdout().toUpperCase().includes("WHAT'S NEXT?"));
    } finally {
      session.cleanup();
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);
});

describe("Standalone mode (backward compat after index.tsx refactor)", () => {
  it("--version still works", () => {
    const out = run(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  }, 15_000);

  it("doctor --stdout still works", () => {
    const out = run(["doctor", "--stdout"]);
    expect(out).toContain("# Workspace Autofix Plan");
  }, 15_000);

  it("doctor --json still works", () => {
    const out = run(["doctor", "--json"]);
    const parsed = JSON.parse(out) as { rootPath: string };
    expect(parsed.rootPath).toBeTruthy();
  }, 15_000);

  it("prompt --stdout still works", () => {
    const out = run(["prompt", "--stdout"]);
    expect(out).toContain("agentlint");
  }, 15_000);

  it("--help shows available commands", () => {
    const out = run(["--help"]);
    expect(out).toContain("init");
    expect(out).toContain("doctor");
    expect(out).toContain("prompt");
  }, 15_000);

  it("help subcommand still works", () => {
    const out = run(["help"]);
    expect(out).toContain("init");
    expect(out).toContain("doctor");
    expect(out).toContain("prompt");
  }, 15_000);

  it("unknown command still errors instead of launching interactive menu", () => {
    const result = runCli(["unknown-command"]);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown command");
    expect(combined.toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");
  }, 15_000);

  it("unknown global flag still errors in standalone parser", () => {
    const result = runCli(["--not-a-real-flag"]);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown option");
    expect(combined.toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");
  }, 15_000);
});

// ── App with initialCommand (standalone TUI routing) ─────────────────────

describe("App with initialCommand", () => {
  it("skips MainMenu and goes directly to doctor, then shows NextAction", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-initial-cmd-"));
    process.chdir(tmpDir);

    const session = renderInTTY(
      React.createElement(App, { initialCommand: "doctor" }),
    );

    try {
      // Should NOT show the main menu
      await sleep(200);
      expect(session.getStdout().toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");

      // Doctor should run and complete
      await waitFor(
        () => session.getStdout().toUpperCase().includes("DISCOVERED ARTIFACTS"),
        { timeoutMs: 10_000 },
      );

      // Should show ContinuePrompt (not auto-exit)
      await waitFor(() => session.getStdout().toLowerCase().includes("continue"));

      // Press Enter to proceed to NextAction
      pressEnter(session.stdin);

      // Should show "What's next?" instead of exiting
      await waitFor(() => session.getStdout().toUpperCase().includes("WHAT'S NEXT?"));
    } finally {
      session.cleanup();
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("can chain from doctor to prompt via NextAction", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-chain-"));
    process.chdir(tmpDir);

    const session = renderInTTY(
      React.createElement(App, { initialCommand: "doctor" }),
    );

    try {
      // Wait for doctor to complete
      await waitFor(
        () => session.getStdout().toUpperCase().includes("DISCOVERED ARTIFACTS"),
        { timeoutMs: 10_000 },
      );

      // Press Enter to proceed to NextAction
      pressEnter(session.stdin);
      await waitFor(() => session.getStdout().toUpperCase().includes("WHAT'S NEXT?"));

      // First option should be prompt (recommended after doctor with report)
      // Press Enter to select it
      await sleep(100);
      pressEnter(session.stdin);

      // Should now show the prompt command output (clipboard copy)
      await waitFor(
        () => session.getStdout().includes("Copied to clipboard") ||
              session.getStdout().includes("Could not copy to clipboard"),
        { timeoutMs: 5_000 },
      );
    } finally {
      session.cleanup();
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("can navigate back to menu from NextAction", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-back-menu-"));
    process.chdir(tmpDir);

    const session = renderInTTY(
      React.createElement(App, { initialCommand: "doctor" }),
    );

    try {
      // Wait for doctor to complete
      await waitFor(
        () => session.getStdout().toUpperCase().includes("DISCOVERED ARTIFACTS"),
        { timeoutMs: 10_000 },
      );

      // Press Enter to proceed to NextAction
      pressEnter(session.stdin);
      await waitFor(() => session.getStdout().toUpperCase().includes("WHAT'S NEXT?"));

      // Navigate to "Back to menu" — it's the 3rd option (index 2)
      // Options: [recommended command, other command, "Back to menu", "Exit"]
      await sleep(100);
      pressArrowDown(session.stdin);
      await sleep(50);
      pressArrowDown(session.stdin);
      await sleep(50);
      pressEnter(session.stdin);

      // Should show the main menu
      await waitFor(() => session.getStdout().toUpperCase().includes("WHAT WOULD YOU LIKE TO DO?"));
    } finally {
      session.cleanup();
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("does not show NextStep hint when running in embedded mode", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-no-hint-"));
    process.chdir(tmpDir);

    const session = renderInTTY(
      React.createElement(App, { initialCommand: "doctor" }),
    );

    try {
      await waitFor(
        () => session.getStdout().toUpperCase().includes("DISCOVERED ARTIFACTS"),
        { timeoutMs: 10_000 },
      );

      const output = session.getStdout();
      // Should NOT show the static ">> Run agent-lint prompt ..." hint
      expect(output).not.toContain(">> Run agent-lint prompt");
    } finally {
      session.cleanup();
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("passes commandOptions.init to InitWizard on first render", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-opts-"));
    process.chdir(tmpDir);

    // With --all, init should skip client selection and go straight to scope selection
    const session = renderInTTY(
      React.createElement(App, {
        initialCommand: "init",
        commandOptions: { init: { all: true } },
      }),
    );

    try {
      // With --all, it should skip "SELECT CLIENTS" and go to "SELECT CONFIG SCOPE"
      await waitFor(
        () => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"),
        { timeoutMs: 5_000 },
      );

      // Should NOT have shown client selection (--all skips it)
      expect(session.getStdout().toUpperCase()).not.toContain("SELECT CLIENTS TO CONFIGURE");
    } finally {
      session.cleanup();
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);
});
