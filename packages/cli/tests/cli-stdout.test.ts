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
  it("doctor --stdout prints canonical artifact report for the fixture workspace", () => {
    const out = run(["doctor", "--stdout"], FIXTURE_WORKSPACE);

    expect(out).toContain("# Workspace Autofix Plan");
    expect(out).toContain("docs\\workflows\\deploy.md");
    expect(out).toContain("docs\\plans\\roadmap.md");
    expect(out).not.toContain(".agentlint-report.md");
    expect(out).not.toContain("packages\\cli\\README.md");
    expect(out).not.toContain("README.md");
  });

  it("doctor --json returns only canonical discovered artifacts", () => {
    const out = run(["doctor", "--json"], FIXTURE_WORKSPACE);
    const parsed = JSON.parse(out) as { discovered: Array<{ relativePath: string }>; missing: unknown[] };
    const relativePaths = parsed.discovered.map((artifact) => artifact.relativePath).sort();

    expect(relativePaths).toEqual([
      ".cursor\\rules\\code-style.md",
      ".windsurf\\skills\\testing\\SKILL.md",
      "AGENTS.md",
      "docs\\plans\\roadmap.md",
      "docs\\workflows\\deploy.md",
    ]);
    expect(parsed.missing).toHaveLength(0);
  });

  it("doctor standalone writes a non-empty report file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-doctor-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# AGENTS\n");

      const result = runCli(["doctor"], tmpDir);
      const reportPath = path.join(tmpDir, ".agentlint-report.md");

      expect(result.status).toBe(0);
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(fs.readFileSync(reportPath, "utf-8").trim().length).toBeGreaterThan(0);
      expect(`${result.stdout}${result.stderr}`).toContain("REPORT SAVED");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("prompt --stdout prints the generic prompt before a report exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-prompt-generic-"));

    try {
      const out = run(["prompt", "--stdout"], tmpDir);
      expect(out).toContain("Run agentlint_plan_workspace_autofix");
      expect(out).not.toContain("Read the file .agentlint-report.md");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("prompt --stdout prints the report-aware prompt when a report exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-prompt-report-"));

    try {
      fs.writeFileSync(path.join(tmpDir, ".agentlint-report.md"), "# report\n");
      const out = run(["prompt", "--stdout"], tmpDir);
      expect(out).toContain("Read the file .agentlint-report.md");
      expect(out).not.toContain("Run agentlint_plan_workspace_autofix");
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

  it("--version prints version from package.json", () => {
    const out = run(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
