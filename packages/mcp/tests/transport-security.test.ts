import { describe, it, expect } from "vitest";
import {
  MAX_JSONRPC_MESSAGE_BYTES,
  TOOL_TIMEOUTS,
  DEFAULT_TOOL_TIMEOUT_MS,
  ToolTimeoutError,
  getToolTimeout,
  withToolTimeout,
} from "../src/transport-security.js";

// ─── Constants ───

describe("transport-security constants", () => {
  it("MAX_JSONRPC_MESSAGE_BYTES is 10MB", () => {
    expect(MAX_JSONRPC_MESSAGE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("DEFAULT_TOOL_TIMEOUT_MS is 30 seconds", () => {
    expect(DEFAULT_TOOL_TIMEOUT_MS).toBe(30_000);
  });

  it("TOOL_TIMEOUTS has all expected tools", () => {
    const expectedTools = [
      "analyze_artifact",
      "analyze_workspace_artifacts",
      "analyze_context_bundle",
      "prepare_artifact_fix_context",
      "submit_client_assessment",
      "suggest_patch",
      "quality_gate_artifact",
      "apply_patches",
      "validate_export",
    ];
    for (const tool of expectedTools) {
      expect(TOOL_TIMEOUTS).toHaveProperty(tool);
      expect(typeof TOOL_TIMEOUTS[tool]).toBe("number");
    }
  });

  it("apply_patches timeout is 15s", () => {
    expect(TOOL_TIMEOUTS["apply_patches"]).toBe(15_000);
  });

  it("validate_export timeout is 10s", () => {
    expect(TOOL_TIMEOUTS["validate_export"]).toBe(10_000);
  });

  it("analyze_workspace_artifacts timeout is 60s", () => {
    expect(TOOL_TIMEOUTS["analyze_workspace_artifacts"]).toBe(60_000);
  });
});

// ─── getToolTimeout ───

describe("getToolTimeout", () => {
  it("returns configured timeout for known tool", () => {
    expect(getToolTimeout("apply_patches")).toBe(15_000);
    expect(getToolTimeout("validate_export")).toBe(10_000);
  });

  it("returns default timeout for unknown tool", () => {
    expect(getToolTimeout("unknown_tool")).toBe(DEFAULT_TOOL_TIMEOUT_MS);
    expect(getToolTimeout("")).toBe(DEFAULT_TOOL_TIMEOUT_MS);
  });
});

// ─── ToolTimeoutError ───

describe("ToolTimeoutError", () => {
  it("has correct name, message, and properties", () => {
    const err = new ToolTimeoutError("analyze_artifact", 30_000);
    expect(err.name).toBe("ToolTimeoutError");
    expect(err.toolName).toBe("analyze_artifact");
    expect(err.timeoutMs).toBe(30_000);
    expect(err.message).toContain("analyze_artifact");
    expect(err.message).toContain("30000");
  });

  it("is an instance of Error", () => {
    const err = new ToolTimeoutError("test_tool", 5000);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ToolTimeoutError);
  });
});

// ─── withToolTimeout ───

describe("withToolTimeout", () => {
  it("resolves normally if function completes in time", async () => {
    const result = await withToolTimeout(
      "test_tool",
      async () => "success",
      5000,
    );
    expect(result).toBe("success");
  });

  it("throws ToolTimeoutError on timeout", async () => {
    await expect(
      withToolTimeout(
        "slow_tool",
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
        50, // 50ms timeout
      ),
    ).rejects.toThrow(ToolTimeoutError);
  });

  it("timeout error has correct tool name", async () => {
    try {
      await withToolTimeout(
        "my_tool",
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
        50,
      );
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ToolTimeoutError);
      if (err instanceof ToolTimeoutError) {
        expect(err.toolName).toBe("my_tool");
        expect(err.timeoutMs).toBe(50);
      }
    }
  });

  it("propagates function errors (not timeout)", async () => {
    await expect(
      withToolTimeout(
        "failing_tool",
        async () => {
          throw new Error("function error");
        },
        5000,
      ),
    ).rejects.toThrow("function error");
  });

  it("uses configured timeout when not explicitly provided", async () => {
    // apply_patches has 15s timeout — function completes instantly, should resolve
    const result = await withToolTimeout("apply_patches", async () => 42);
    expect(result).toBe(42);
  });
});
