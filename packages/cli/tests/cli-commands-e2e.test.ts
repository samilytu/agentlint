/**
 * CLI command e2e tests — focus on 'score' command and additional init/doctor scenarios
 * not already covered by cli-stdout.test.ts.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const TSX_PATH = path.resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SOURCE_CLI_PATH = path.resolve(ROOT, "packages", "cli", "src", "index.tsx");
const FIXTURES_DIR = path.resolve(ROOT, "fixtures");

function run(args: string[], cwd?: string, env?: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [TSX_PATH, SOURCE_CLI_PATH, ...args], {
    cwd: cwd ?? ROOT,
    encoding: "utf-8",
    timeout: 15_000,
    env: { ...process.env, ...env },
  });
}

function runCli(args: string[], cwd?: string, env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [TSX_PATH, SOURCE_CLI_PATH, ...args], {
    cwd: cwd ?? ROOT,
    encoding: "utf-8",
    timeout: 15_000,
    env: { ...process.env, ...env },
  });
}

// ── score command ─────────────────────────────────────────────────────────

describe("score command", () => {
  it("scores a good-agents fixture and returns markdown report", () => {
    const fixturePath = path.join(FIXTURES_DIR, "good-agents.md");
    const out = run(["score", fixturePath]);

    expect(out).toContain("Score");
    // Should show a numeric score like "8/10" or "10/10"
    expect(out).toMatch(/\d+\s*\/\s*\d+/);
  }, 15_000);

  it("scores a bad-agents fixture and shows improvement suggestions", () => {
    const fixturePath = path.join(FIXTURES_DIR, "bad-agents.md");
    const out = run(["score", fixturePath]);

    expect(out).toContain("Score");
    expect(out).toMatch(/\d+\s*\/\s*\d+/);
  }, 15_000);

  it("scores with --type flag override", () => {
    const fixturePath = path.join(FIXTURES_DIR, "good-rules.md");
    const out = run(["score", fixturePath, "--type", "rules"]);

    expect(out).toContain("Score");
    expect(out).toMatch(/\d+\s*\/\s*\d+/);
  }, 15_000);

  it("scores a workflows artifact", () => {
    const fixturePath = path.join(FIXTURES_DIR, "good-workflows.md");
    const out = run(["score", fixturePath]);

    expect(out).toContain("Score");
  }, 15_000);

  it("scores a plans artifact", () => {
    const fixturePath = path.join(FIXTURES_DIR, "good-plans.md");
    const out = run(["score", fixturePath]);

    expect(out).toContain("Score");
  }, 15_000);

  it("scores a skills artifact", () => {
    const fixturePath = path.join(FIXTURES_DIR, "good-skills.md");
    const out = run(["score", fixturePath]);

    expect(out).toContain("Score");
  }, 15_000);

  it("exits with non-zero status for a non-existent file", () => {
    const result = runCli(["score", "/nonexistent/file/that/does/not/exist.md"]);

    expect(result.status).not.toBe(0);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(combined.length).toBeGreaterThan(0);
  }, 15_000);

  it("exits with non-zero status when no file argument provided", () => {
    const result = runCli(["score"]);

    expect(result.status).not.toBe(0);
  }, 15_000);
});

// ── init --all flag ───────────────────────────────────────────────────────

describe("init --all flag", () => {
  it("init --all --stdout installs for all detected clients", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-all-"));
    // Create a .vscode directory to trigger detection
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      const out = run(["init", "--all", "--stdout"], tmpDir);
      expect(out.trim().length).toBeGreaterThan(0);
      // At minimum, VS Code should be installed since we created .vscode
      expect(fs.existsSync(path.join(tmpDir, ".vscode", "mcp.json"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("init --all --stdout is idempotent (second run shows [exists] or [created])", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-init-idempotent-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      // First run
      run(["init", "--all", "--stdout"], tmpDir);
      // Second run — should not fail
      const out2 = run(["init", "--all", "--stdout"], tmpDir);
      // Either exists or created (shouldn't throw)
      expect(out2.trim().length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30_000);
});

// ── DEBUG=agentlint:* integration ─────────────────────────────────────────

describe("DEBUG=agentlint:* integration", () => {
  it("produces debug output on stderr when DEBUG=agentlint:*", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-debug-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      const result = runCli(
        ["init", "--all", "--stdout"],
        tmpDir,
        { DEBUG: "agentlint:*" },
      );

      // stderr should contain debug output
      expect(result.stderr).toContain("[agentlint:");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("produces no debug output on stderr when DEBUG is not set", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-nodebug-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      // Explicitly unset DEBUG
      const env = { ...process.env };
      delete env["DEBUG"];

      const result = spawnSync(
        process.execPath,
        [TSX_PATH, SOURCE_CLI_PATH, "init", "--all", "--stdout"],
        { cwd: tmpDir, encoding: "utf-8", timeout: 15_000, env },
      );

      expect(result.stderr ?? "").not.toContain("[agentlint:");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("produces debug output for specific namespace when DEBUG=agentlint:config-writer", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-debug-ns-"));
    fs.mkdirSync(path.join(tmpDir, ".vscode"));

    try {
      const result = runCli(
        ["init", "--all", "--stdout"],
        tmpDir,
        { DEBUG: "agentlint:config-writer" },
      );

      expect(result.stderr).toContain("[agentlint:config-writer]");
      // clients namespace should NOT appear
      expect(result.stderr).not.toContain("[agentlint:clients]");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);
});

// ── doctor --json structure ───────────────────────────────────────────────

describe("doctor --json output structure", () => {
  it("includes rootPath, discovered, missing, and summary fields", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-doctor-json-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# AGENTS\n");

      const out = run(["doctor", "--json"], tmpDir);
      const parsed = JSON.parse(out) as {
        rootPath: string;
        discovered: unknown[];
        missing: unknown[];
        summary: {
          missingCount: number;
          incompleteCount: number;
          recommendedPromptMode: string;
        };
      };

      expect(typeof parsed.rootPath).toBe("string");
      expect(Array.isArray(parsed.discovered)).toBe(true);
      expect(Array.isArray(parsed.missing)).toBe(true);
      expect(typeof parsed.summary.missingCount).toBe("number");
      expect(typeof parsed.summary.incompleteCount).toBe("number");
      expect(typeof parsed.summary.recommendedPromptMode).toBe("string");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("discovered artifacts include relativePath field", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-doctor-json-paths-"));

    try {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# AGENTS\n");

      const out = run(["doctor", "--json"], tmpDir);
      const parsed = JSON.parse(out) as {
        discovered: Array<{ relativePath: string }>;
      };

      expect(parsed.discovered.length).toBeGreaterThan(0);
      for (const artifact of parsed.discovered) {
        expect(typeof artifact.relativePath).toBe("string");
        expect(artifact.relativePath.length).toBeGreaterThan(0);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 15_000);
});

// ── Error handling ────────────────────────────────────────────────────────

describe("CLI error handling", () => {
  it("unknown command exits with non-zero and includes error message", () => {
    const result = runCli(["this-command-does-not-exist"]);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown command");
  }, 15_000);

  it("unknown global flag exits with non-zero and includes error message", () => {
    const result = runCli(["--totally-unknown-flag"]);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown option");
  }, 15_000);

  it("score with invalid --type flag exits with non-zero", () => {
    const result = runCli(["score", "AGENTS.md", "--type", "not-a-real-type"]);

    expect(result.status).not.toBe(0);
  }, 15_000);
});
