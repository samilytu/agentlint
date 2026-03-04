import { execFileSync, spawn, spawnSync } from "node:child_process";
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

type SpawnInteractiveOptions = {
  cwd?: string;
  args?: string[];
  killAfterMs?: number;
};

/**
 * Spawn CLI in interactive mode and collect rendered output.
 */
function spawnInteractive(options: SpawnInteractiveOptions = {}): Promise<{ stderr: string; stdout: string; status: number | null }> {
  const {
    cwd,
    args = [],
    killAfterMs = 2000,
  } = options;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: cwd ?? ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });

    let settled = false;
    let status: number | null = null;
    let stderr = "";
    let stdout = "";
    const timers: NodeJS.Timeout[] = [];

    const resolveOnce = (flushDelayMs: number) => {
      if (settled) return;
      settled = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
      setTimeout(() => resolve({ stderr, stdout, status }), flushDelayMs);
    };

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    // Give Ink time to render, then kill
    const killTimer = setTimeout(() => {
      child.kill("SIGTERM");
      resolveOnce(200);
    }, killAfterMs);
    timers.push(killTimer);

    child.on("exit", (code) => {
      status = code;
      resolveOnce(100);
    });
  });
}

describe("Interactive mode (bare invocation)", () => {
  it("renders main menu with all options on stdout", async () => {
    const { stdout } = await spawnInteractive();
    // Ink renders the TUI to stdout
    // SectionTitle renders text in UPPERCASE with "// " prefix
    expect(stdout.toUpperCase()).toContain("WHAT WOULD YOU LIKE TO DO?");
    expect(stdout).toContain("init");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("prompt");
    expect(stdout).toContain("Exit");
  }, 10_000);

  it("renders the banner on stdout", async () => {
    const { stdout } = await spawnInteractive();
    // Banner contains version info
    expect(stdout).toContain("v0.");
  }, 10_000);

  it("does not immediately exit (produces output before kill)", async () => {
    const { stdout } = await spawnInteractive();
    // If interactive mode is working, there should be rendered output
    expect(stdout.length).toBeGreaterThan(0);
  }, 10_000);

  it("treats bare '--' as interactive invocation", async () => {
    const { stdout } = await spawnInteractive({ args: ["--"] });
    expect(stdout.toUpperCase()).toContain("WHAT WOULD YOU LIKE TO DO?");
    expect(stdout).toContain("Set up MCP config (init)");
  }, 10_000);
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
    const result = spawnSync(process.execPath, [CLI_PATH, "unknown-command"], {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 10_000,
    });

    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown command");
    expect(combined.toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");
  });

  it("unknown global flag still errors in standalone parser", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "--not-a-real-flag"], {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 10_000,
    });

    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(result.status).not.toBe(0);
    expect(combined.toLowerCase()).toContain("unknown option");
    expect(combined.toUpperCase()).not.toContain("WHAT WOULD YOU LIKE TO DO?");
  });
});
