import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoctorApp } from "../src/commands/doctor.js";
import { InitWizard } from "../src/commands/init.js";
import { PromptApp } from "../src/commands/prompt.js";
import { pressEnter, renderInTTY, sleep, waitFor } from "./tty-test-utils.js";

const clipboard = vi.hoisted(() => ({
  write: vi.fn(),
}));

vi.mock("clipboardy", () => ({
  default: {
    write: clipboard.write,
  },
}));

async function withTempCwd(fn: () => Promise<void>): Promise<void> {
  const originalCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-cli-test-"));

  process.chdir(tmpDir);

  try {
    await fn();
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("Embedded command flows", () => {
  afterEach(() => {
    clipboard.write.mockReset();
    vi.restoreAllMocks();
  });

  it("waits for Enter before completing doctor in embedded mode", async () => {
    await withTempCwd(async () => {
      const onComplete = vi.fn();
      const session = renderInTTY(
        React.createElement(DoctorApp, { onComplete, showBanner: false }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("DISCOVERED ARTIFACTS"),
          { timeoutMs: 5_000 },
        );

        await sleep(350);
        expect(onComplete).not.toHaveBeenCalled();
        // No report file should exist without --save-report
        expect(fs.existsSync(path.join(process.cwd(), ".agentlint-report.md"))).toBe(false);

        pressEnter(session.stdin);

        await waitFor(() => onComplete.mock.calls.length === 1);
      } finally {
        session.cleanup();
      }
    });
  });

  it("does not render missing artifact entries in the doctor TUI", async () => {
    await withTempCwd(async () => {
      fs.writeFileSync(path.join(process.cwd(), "AGENTS.md"), "# AGENTS\n");

      const onComplete = vi.fn();
      const session = renderInTTY(
        React.createElement(DoctorApp, { onComplete, showBanner: false }),
      );

      try {
        await waitFor(
          () => session.getStdout().toUpperCase().includes("DISCOVERED ARTIFACTS"),
          { timeoutMs: 5_000 },
        );

        const output = session.getStdout();
        expect(output).toContain("AGENTS.md (agents)");
        expect(output).not.toContain("MISSING ARTIFACT TYPES");
        expect(output).not.toContain("skills ->");
        expect(output).not.toContain("workflows ->");
      } finally {
        session.cleanup();
      }
    });
  });

  it("waits for Enter before completing init in embedded mode", async () => {
    await withTempCwd(async () => {
      const onComplete = vi.fn();
      const session = renderInTTY(
        React.createElement(InitWizard, {
          options: { all: true },
          onComplete,
          showBanner: false,
        }),
      );

      try {
        await waitFor(() => session.getStdout().toUpperCase().includes("SELECT CONFIG SCOPE"));

        pressEnter(session.stdin);

        await waitFor(
          () => session.getStdout().toUpperCase().includes("INSTALL MAINTENANCE RULES"),
          { timeoutMs: 5_000 },
        );

        pressEnter(session.stdin);

        await waitFor(
          () => session.getStdout().includes("MCP config is ready."),
          { timeoutMs: 5_000 },
        );

        await sleep(350);
        expect(onComplete).not.toHaveBeenCalled();

        pressEnter(session.stdin);

        await waitFor(() => onComplete.mock.calls.length === 1);
        const results = onComplete.mock.calls[0]?.[0];
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
      } finally {
        session.cleanup();
      }
    });
  }, 10_000);

  it("keeps the copied prompt visible until the user confirms", async () => {
    clipboard.write.mockResolvedValue(undefined);

    await withTempCwd(async () => {
      const onComplete = vi.fn();
      const session = renderInTTY(
        React.createElement(PromptApp, { onComplete, showBanner: false }),
      );

      try {
        await waitFor(() => session.getStdout().includes("Copied to clipboard!"));

        await sleep(350);
        expect(onComplete).not.toHaveBeenCalled();
        expect(session.getStdout().replace(/\s+/g, " ")).toContain(
          "Prioritize missing artifacts first",
        );

        pressEnter(session.stdin);

        await waitFor(() => onComplete.mock.calls.length === 1);
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            copied: true,
          }),
        );
      } finally {
        session.cleanup();
      }
    });
  });

  it("keeps the manual-copy fallback visible until the user confirms", async () => {
    clipboard.write.mockRejectedValue(new Error("Clipboard unavailable"));

    await withTempCwd(async () => {
      const onComplete = vi.fn();
      const session = renderInTTY(
        React.createElement(PromptApp, { onComplete, showBanner: false }),
      );

      try {
        await waitFor(() => session.getStdout().includes("Could not copy to clipboard."));

        await sleep(350);
        expect(onComplete).not.toHaveBeenCalled();
        expect(session.getStdout()).toContain("Copy the prompt below manually.");
        expect(session.getStdout()).toContain("Prioritize missing artifacts first");

        pressEnter(session.stdin);

        await waitFor(() => onComplete.mock.calls.length === 1);
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            copied: false,
          }),
        );
      } finally {
        session.cleanup();
      }
    });
  });
});
