import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { App } from "../src/app.js";
import { pressEnter, renderInTTY, sleep, waitFor } from "./tty-test-utils.js";

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
  });

  it("doctor --stdout still works", () => {
    const out = run(["doctor", "--stdout"]);
    expect(out).toContain("# Workspace Autofix Plan");
  });

  it("doctor --json still works", () => {
    const out = run(["doctor", "--json"]);
    const parsed = JSON.parse(out) as { rootPath: string };
    expect(parsed.rootPath).toBeTruthy();
  });

  it("prompt --stdout still works", () => {
    const out = run(["prompt", "--stdout"]);
    expect(out).toContain("agentlint");
  });

  it("--help shows available commands", () => {
    const out = run(["--help"]);
    expect(out).toContain("init");
    expect(out).toContain("doctor");
    expect(out).toContain("prompt");
  });

  it("help subcommand still works", () => {
    const out = run(["help"]);
    expect(out).toContain("init");
    expect(out).toContain("doctor");
    expect(out).toContain("prompt");
  });

  it("unknown command still errors instead of launching interactive menu", () => {
    const result = runCli(["unknown-command"]);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown command");
    expect(combined.toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");
  });

  it("unknown global flag still errors in standalone parser", () => {
    const result = runCli(["--not-a-real-flag"]);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown option");
    expect(combined.toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");
  });
});
