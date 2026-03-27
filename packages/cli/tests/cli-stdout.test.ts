import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const TSX_PATH = path.resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SOURCE_CLI_PATH = path.resolve(ROOT, "packages", "cli", "src", "index.tsx");
const FIXTURE_WORKSPACE = path.resolve(ROOT, "fixtures", "workspace");

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

describe("CLI output modes", () => {
  it("scan --stdout prints canonical artifact report for the fixture workspace", () => {
    const out = run(["scan", "--stdout"], FIXTURE_WORKSPACE).replace(/\\/g, "/");

    expect(out).toContain("# Workspace Autofix Plan");
    expect(out).toContain("## Context summary");
    expect(out).toContain("docs/workflows/deploy.md");
    expect(out).toContain("docs/plans/roadmap.md");
    expect(out).not.toContain(".agentlint-report.md");
  });

  it("scan --json returns only canonical discovered artifacts", () => {
    const out = run(["scan", "--json"], FIXTURE_WORKSPACE);
    const parsed = JSON.parse(out) as {
      discovered: Array<{ relativePath: string }>;
      missing: unknown[];
      summary: { recommendedPromptMode: string; missingCount: number; incompleteCount: number };
    };
    const relativePaths = parsed.discovered
      .map((artifact) => artifact.relativePath.replace(/\\/g, "/"))
      .sort();

    expect(relativePaths).toContain(".cursor/rules/code-style.md");
    expect(relativePaths).toContain(".windsurf/skills/testing/SKILL.md");
    expect(relativePaths).toContain("AGENTS.md");
    expect(relativePaths).toContain("docs/plans/roadmap.md");
    expect(relativePaths).toContain("docs/workflows/deploy.md");
    expect(parsed.missing).toHaveLength(0);
    expect(parsed.summary.missingCount).toBe(0);
    expect(parsed.summary.incompleteCount).toBe(0);
    expect(parsed.summary.recommendedPromptMode).toBe("targeted-maintenance");
  });

  it("scan --save-report writes a non-empty report file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-scan-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# AGENTS\n");

      const result = runCli(["scan", "--save-report"], tmpDir);
      const reportPath = path.join(tmpDir, ".agentlint-report.md");

      expect(result.status).toBe(0);
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(fs.readFileSync(reportPath, "utf-8").trim().length).toBeGreaterThan(0);
      expect(`${result.stdout}${result.stderr}`).toContain("REPORT SAVED");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("scan without --save-report does not write a report file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-scan-no-report-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# AGENTS\n");

      const result = runCli(["scan"], tmpDir);
      const reportPath = path.join(tmpDir, ".agentlint-report.md");

      expect(result.status).toBe(0);
      expect(fs.existsSync(reportPath)).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("prompt --stdout prints the MCP prompt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-prompt-generic-"));

    try {
      const out = run(["prompt", "--stdout"], tmpDir);
      expect(out).toContain("Run agentlint_plan_workspace_autofix");
      expect(out).toContain("Prioritize missing artifacts first");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("prompt --stdout switches to targeted maintenance when canonical artifacts look healthy", () => {
    const out = run(["prompt", "--stdout"], FIXTURE_WORKSPACE);
    // When local changes exist, quick-check signals are shown instead of generic agentlint_quick_check
    const hasQuickCheckSignals = out.includes("Quick-check signals from local changes");
    const hasGenericQuickCheck = out.includes("agentlint_quick_check");
    expect(hasQuickCheckSignals || hasGenericQuickCheck).toBe(true);
    expect(out).toContain("Detected context artifacts:");
  });

  it("prompt --stdout includes quick-check signals from local git changes when available", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-prompt-git-"));

    try {
      fs.cpSync(FIXTURE_WORKSPACE, tmpDir, { recursive: true });
      execFileSync("git", ["init"], { cwd: tmpDir, encoding: "utf-8" });
      execFileSync("git", ["config", "user.email", "agentlint@example.com"], { cwd: tmpDir, encoding: "utf-8" });
      execFileSync("git", ["config", "user.name", "Agent Lint"], { cwd: tmpDir, encoding: "utf-8" });
      execFileSync("git", ["add", "."], { cwd: tmpDir, encoding: "utf-8" });
      execFileSync("git", ["commit", "-m", "init"], { cwd: tmpDir, encoding: "utf-8" });
      fs.appendFileSync(path.join(tmpDir, "AGENTS.md"), "\n- Local review note.\n", "utf-8");

      const out = run(["prompt", "--stdout"], tmpDir);
      expect(out).toContain("Quick-check signals from local changes:");
      expect(out).toContain("Root context baseline changed");
      expect(out).toContain("Local changed paths detected:");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --stdout creates workspace config files in a temp dir", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      const out = run(["init", "--stdout"], tmpDir);
      expect(out.trim().length).toBeGreaterThan(0);
      expect(out).toContain("[created]");
      expect(fs.existsSync(path.join(tmpDir, ".vscode", "mcp.json"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --stdout --with-rules installs maintenance rules alongside MCP config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-rules-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      const out = run(["init", "--stdout", "--with-rules"], tmpDir);
      expect(out).toContain("[created]");
      expect(out).toContain("[rule created]");
      expect(fs.existsSync(path.join(tmpDir, ".vscode", "mcp.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".github", "copilot-instructions.md"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --stdout --yes accepts the maintenance rule prompt default", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-yes-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      const out = run(["init", "--stdout", "--yes"], tmpDir);
      expect(out).toContain("[created]");
      expect(out).toMatch(/\[rule (created|updated|appended|skip)\]/);
      expect(fs.existsSync(path.join(tmpDir, ".github", "copilot-instructions.md"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --stdout repairs stale config entries instead of skipping them", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-update-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".vscode", "mcp.json"),
      JSON.stringify({ servers: { agentlint: { command: "node", args: ["legacy"] } } }, null, 2),
      "utf-8",
    );

    try {
      const out = run(["init", "--stdout"], tmpDir);
      expect(out).toContain("[updated]");
      const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, ".vscode", "mcp.json"), "utf-8")) as {
        servers: { agentlint: { command: string; args: string[] } };
      };
      expect(parsed.servers.agentlint.command).toBe("npx");
      expect(parsed.servers.agentlint.args).toEqual(["-y", "@agent-lint/mcp"]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--version prints version from package.json", () => {
    const out = run(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
