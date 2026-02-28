import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createWatcher, type WatchHandle, type WatchOptions } from "../src/watch.js";

// ─── Helpers ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Tests ───────────────────────────────────────────────────────

describe("createWatcher", () => {
  let tempDir: string;
  let handle: WatchHandle | null = null;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `agentlint-watch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (handle) {
      handle.close();
      handle = null;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects new .md file creation", async () => {
    const changes: string[] = [];

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async (changedPath) => {
        changes.push(changedPath);
      },
      debounceMs: 50,
    });

    // Wait for watcher to initialize
    await sleep(100);

    // Create a new markdown file
    await writeFile(join(tempDir, "AGENTS.md"), "# Test\n", "utf8");

    // Wait for debounce + processing
    await sleep(400);

    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes.some((p) => p.includes("AGENTS.md"))).toBe(true);
  });

  it("ignores non-matching extensions", async () => {
    const changes: string[] = [];

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async (changedPath) => {
        changes.push(changedPath);
      },
      debounceMs: 50,
    });

    await sleep(100);

    // Create a .ts file — should be ignored
    await writeFile(join(tempDir, "index.ts"), "export {};", "utf8");

    await sleep(400);

    expect(changes).toHaveLength(0);
  });

  it("ignores node_modules changes", async () => {
    const changes: string[] = [];
    const nmDir = join(tempDir, "node_modules", "some-pkg");
    await mkdir(nmDir, { recursive: true });

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async (changedPath) => {
        changes.push(changedPath);
      },
      debounceMs: 50,
    });

    await sleep(100);

    await writeFile(join(nmDir, "README.md"), "# Pkg\n", "utf8");

    await sleep(400);

    expect(changes).toHaveLength(0);
  });

  it("can be closed via close()", async () => {
    const changes: string[] = [];

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async (changedPath) => {
        changes.push(changedPath);
      },
      debounceMs: 50,
    });

    await sleep(100);

    // Close the watcher
    handle.close();
    handle = null;

    // Create a file after closing — should not trigger
    await writeFile(join(tempDir, "AGENTS.md"), "# Test\n", "utf8");

    await sleep(400);

    expect(changes).toHaveLength(0);
  });

  it("can be aborted via AbortSignal", async () => {
    const changes: string[] = [];
    const ac = new AbortController();

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async (changedPath) => {
        changes.push(changedPath);
      },
      debounceMs: 50,
      signal: ac.signal,
    });

    await sleep(100);

    // Abort
    ac.abort();

    // Create a file after abort — should not trigger
    await writeFile(join(tempDir, "AGENTS.md"), "# Test\n", "utf8");

    await sleep(400);

    expect(changes).toHaveLength(0);
  });

  it("debounces rapid changes", async () => {
    let callCount = 0;

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async () => {
        callCount++;
      },
      debounceMs: 200,
    });

    await sleep(100);

    // Rapidly modify the same file
    for (let i = 0; i < 5; i++) {
      await writeFile(join(tempDir, "test.md"), `# Iteration ${i}\n`, "utf8");
      await sleep(20);
    }

    // Wait for debounce to settle
    await sleep(500);

    // Due to debouncing, should have fewer calls than modifications
    // The exact number depends on OS timing, but should be significantly less than 5
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeLessThanOrEqual(3); // Generous tolerance for CI
  });

  it("supports custom extensions filter", async () => {
    const changes: string[] = [];

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async (changedPath) => {
        changes.push(changedPath);
      },
      debounceMs: 50,
      extensions: [".yaml"],
    });

    await sleep(100);

    // .yaml should match
    await writeFile(join(tempDir, "config.yaml"), "key: value\n", "utf8");
    // .md should NOT match with this custom filter
    await writeFile(join(tempDir, "README.md"), "# Hi\n", "utf8");

    await sleep(400);

    expect(changes.some((p) => p.includes("config.yaml"))).toBe(true);
    expect(changes.some((p) => p.includes("README.md"))).toBe(false);
  });

  it("handles onChange errors gracefully", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    handle = createWatcher({
      rootDir: tempDir,
      onChange: async () => {
        throw new Error("callback error");
      },
      debounceMs: 50,
    });

    await sleep(100);

    await writeFile(join(tempDir, "test.md"), "# Error test\n", "utf8");

    await sleep(400);

    // Should log error to stderr, not crash
    expect(stderrSpy).toHaveBeenCalled();
    const calls = stderrSpy.mock.calls.map((call) => String(call[0]));
    expect(calls.some((c) => c.includes("callback error"))).toBe(true);

    stderrSpy.mockRestore();
  });
});
