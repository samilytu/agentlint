import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

type CliRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type ExecFileError = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
};

async function runCli(args: string[]): Promise<CliRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "packages/cli/src/index.ts", ...args],
      {
        cwd: process.cwd(),
      },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const typedError = error as ExecFileError;
    const rawCode = typedError.code;
    const code = typeof rawCode === "number" ? rawCode : 1;
    return {
      code,
      stdout: typedError.stdout ?? "",
      stderr: typedError.stderr ?? "",
    };
  }
}

describe("CLI command integration", () => {
  it("runs analyze command successfully", async () => {
    const result = await runCli(["analyze", "AGENTS.md"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Score");
  });

  it("runs scan command and finds artifacts", async () => {
    const result = await runCli(["scan", "."]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Artifacts:");
  });

  it("runs score command and prints numeric value", async () => {
    const result = await runCli(["score", "AGENTS.md"]);

    expect(result.code).toBe(0);
    const parsed = Number(result.stdout.trim());
    expect(Number.isFinite(parsed)).toBe(true);
    expect(parsed).toBeGreaterThanOrEqual(0);
    expect(parsed).toBeLessThanOrEqual(100);
  });

  it("emits valid JSON with --json flag", async () => {
    const result = await runCli(["score", "AGENTS.md", "--json"]);

    expect(result.code).toBe(0);
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toBeTruthy();
    expect(typeof parsed).toBe("object");
  });

  it("returns exit code 1 for --fail-below 100", async () => {
    const result = await runCli(["score", "AGENTS.md", "--fail-below", "100"]);

    expect(result.code).toBe(1);
  });

  it("returns exit code 0 for --fail-below 50", async () => {
    const result = await runCli(["score", "AGENTS.md", "--fail-below", "50"]);

    expect(result.code).toBe(0);
  });

  it("returns exit code 1 for invalid file path", async () => {
    const result = await runCli(["analyze", "missing-file.md"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("analyze failed");
  });

  it("returns usage error when arguments are missing", async () => {
    const result = await runCli(["analyze"]);

    expect(result.code).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain("missing required argument");
  });
});
