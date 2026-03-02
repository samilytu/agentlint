import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CLI_PATH = path.resolve(__dirname, "..", "dist", "index.js");
const ROOT = path.resolve(__dirname, "../../..");

function run(args: string[], cwd?: string): string {
  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd: cwd ?? ROOT,
    encoding: "utf-8",
    timeout: 10_000,
  });
}

describe("CLI --stdout modes", () => {
  it("doctor --stdout prints markdown report", () => {
    const out = run(["doctor", "--stdout"]);
    expect(out).toContain("# Workspace Autofix Plan");
    expect(out).toContain("## Discovered artifacts");
  });

  it("doctor --json prints valid JSON", () => {
    const out = run(["doctor", "--json"]);
    const parsed = JSON.parse(out) as { rootPath: string; discovered: unknown[] };
    expect(parsed.rootPath).toBeTruthy();
    expect(Array.isArray(parsed.discovered)).toBe(true);
  });

  it("prompt --stdout prints prompt text", () => {
    const out = run(["prompt", "--stdout"]);
    expect(out).toContain("agentlint");
    expect(out.trim().length).toBeGreaterThan(0);
  });

  it("init --stdout prints results in a temp dir", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-test-"));
    // Create a .vscode dir so init detects it
    fs.mkdirSync(path.join(tmpDir, ".vscode"));
    try {
      const out = run(["init", "--stdout"], tmpDir);
      expect(out.trim().length).toBeGreaterThan(0);
      expect(out).toContain("[created]");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--version prints version from package.json", () => {
    const out = run(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
