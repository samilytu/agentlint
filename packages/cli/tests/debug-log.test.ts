import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We test debugLog behavior directly by importing after setting env
async function loadDebugLog() {
  vi.resetModules();
  const mod = await import("../src/debug.js");
  return mod.debugLog;
}

describe("debugLog", () => {
  let stderrWrites: string[] = [];
  let originalWrite: typeof process.stderr.write;

  beforeEach(() => {
    stderrWrites = [];
    originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrWrites.push(chunk.toString());
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
    delete process.env["DEBUG"];
    vi.resetModules();
  });

  it("is silent when DEBUG is not set", async () => {
    delete process.env["DEBUG"];
    const debugLog = await loadDebugLog();
    debugLog("config-writer", "test message");
    expect(stderrWrites).toHaveLength(0);
  });

  it("is silent when DEBUG is empty string", async () => {
    process.env["DEBUG"] = "";
    const debugLog = await loadDebugLog();
    debugLog("config-writer", "test message");
    expect(stderrWrites).toHaveLength(0);
  });

  it("writes to stderr when DEBUG=agentlint:*", async () => {
    process.env["DEBUG"] = "agentlint:*";
    const debugLog = await loadDebugLog();
    debugLog("config-writer", "merge started", "/some/path");
    expect(stderrWrites).toHaveLength(1);
    expect(stderrWrites[0]).toContain("[agentlint:config-writer]");
    expect(stderrWrites[0]).toContain("merge started");
    expect(stderrWrites[0]).toContain("/some/path");
  });

  it("writes to stderr when DEBUG matches exact namespace", async () => {
    process.env["DEBUG"] = "agentlint:clients";
    const debugLog = await loadDebugLog();
    debugLog("clients", "detected cursor");
    expect(stderrWrites).toHaveLength(1);
    expect(stderrWrites[0]).toContain("[agentlint:clients]");
  });

  it("is silent when DEBUG matches different namespace", async () => {
    process.env["DEBUG"] = "agentlint:clients";
    const debugLog = await loadDebugLog();
    debugLog("config-writer", "some config message");
    expect(stderrWrites).toHaveLength(0);
  });

  it("includes all extra args in the output", async () => {
    process.env["DEBUG"] = "agentlint:*";
    const debugLog = await loadDebugLog();
    debugLog("test", "status=created", "path=/foo", "extra");
    expect(stderrWrites[0]).toContain("status=created");
    expect(stderrWrites[0]).toContain("path=/foo");
    expect(stderrWrites[0]).toContain("extra");
  });

  it("ends each log line with a newline", async () => {
    process.env["DEBUG"] = "agentlint:*";
    const debugLog = await loadDebugLog();
    debugLog("test", "line");
    expect(stderrWrites[0]).toMatch(/\n$/);
  });
});
