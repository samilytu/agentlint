import { execFileSync } from "node:child_process";
import path from "node:path";
import React, { useState, useEffect } from "react";
import { Box, Text, render } from "ink";
import clipboardy from "clipboardy";
import { buildWorkspaceAutofixPlan, runQuickCheck } from "@agent-lint/core";
import {
  Banner,
  ContinuePrompt,
  PromptBox,
  Divider,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";

function summarizeActiveArtifacts(paths: string[]): string {
  if (paths.length === 0) {
    return "No canonical context artifacts were detected yet.";
  }

  const preview = paths.slice(0, 4).map((value) => `\`${value}\``).join(", ");
  return paths.length > 4
    ? `Detected context artifacts: ${preview}, and ${paths.length - 4} more.`
    : `Detected context artifacts: ${preview}.`;
}

function normalizeCliPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function parseGitStatusPaths(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 3)
    .map((line) => {
      const rawPath = line.slice(3).trim();
      const finalPath = rawPath.includes(" -> ")
        ? rawPath.split(" -> ").at(-1) ?? rawPath
        : rawPath;
      return normalizeCliPath(finalPath);
    })
    .filter((value) => value.length > 0);
}

function detectLocalChangedPaths(rootPath: string): string[] {
  try {
    const output = execFileSync(
      "git",
      ["status", "--short", "--untracked-files=all"],
      {
        cwd: rootPath,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    return parseGitStatusPaths(output).filter((changedPath) => {
      const resolved = normalizeCliPath(
        path.relative(rootPath, path.resolve(rootPath, changedPath)),
      );
      return resolved.length > 0 && !resolved.startsWith("..");
    });
  } catch {
    return [];
  }
}

function summarizeQuickCheckTriggers(changedPaths: string[]): string | null {
  if (changedPaths.length === 0) {
    return null;
  }

  const quickCheck = runQuickCheck(changedPaths);
  if (quickCheck.signals.length === 0) {
    return "No focused quick-check signals were detected from local changes.";
  }

  const preview = quickCheck.signals.slice(0, 3).map((signal) => `\`${signal.trigger}\``).join(", ");
  return quickCheck.signals.length > 3
    ? `Quick-check signals from local changes: ${preview}, and ${quickCheck.signals.length - 3} more.`
    : `Quick-check signals from local changes: ${preview}.`;
}

function buildPrompt(rootPath: string = process.cwd()): string {
  const plan = buildWorkspaceAutofixPlan(rootPath);
  const changedPaths = detectLocalChangedPaths(rootPath);
  const summaryLine = summarizeActiveArtifacts(plan.summary.activeArtifacts);
  const quickCheckLine = summarizeQuickCheckTriggers(changedPaths);

  if (plan.summary.recommendedPromptMode === "broad-scan") {
    return [
      "Run agentlint_plan_workspace_autofix to scan this project for agent context artifacts",
      "(AGENTS.md, CLAUDE.md, rules, skills, workflows, and plans) and execute the fix plan step by step.",
      "Prioritize missing artifacts first, then stale references, conflicting tool-specific guidance, and weak-but-present sections.",
      "Use agentlint_get_guidelines for each artifact type before editing.",
      "Apply safe context-artifact changes directly unless I explicitly want a different outcome, and tell me when Agent Lint guidance triggered the update.",
      quickCheckLine,
      summaryLine,
    ].filter((value): value is string => Boolean(value)).join(" ");
  }

  return [
    quickCheckLine ?? "Start with agentlint_quick_check using the files or directories I recently changed.",
    "If there is no narrow change set, fall back to agentlint_plan_workspace_autofix for a full workspace pass.",
    "Then update only the affected context artifacts, using agentlint_get_guidelines before each edit.",
    "Keep the work focused on stale, conflicting, or weak artifact guidance and tell me when Agent Lint guidance shaped the update.",
    changedPaths.length > 0
      ? `Local changed paths detected: ${changedPaths.slice(0, 4).map((value) => `\`${value}\``).join(", ")}${changedPaths.length > 4 ? `, and ${changedPaths.length - 4} more.` : "."}`
      : null,
    summaryLine,
  ].filter((value): value is string => Boolean(value)).join(" ");
}

export interface PromptResult {
  prompt: string;
  copied: boolean;
}

export interface PromptAppProps {
  /** When provided, called instead of process exit (embedded mode) */
  onComplete?: (result: PromptResult) => void;
  /** Whether to show banner (standalone mode). Default: true */
  showBanner?: boolean;
}

export function PromptApp({ onComplete, showBanner = true }: PromptAppProps): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [prompt] = useState(() => buildPrompt(process.cwd()));

  useEffect(() => {
    clipboardy
      .write(prompt)
      .then(() => setCopied(true))
      .catch(() => setCopyError(true));
  }, [prompt]);
  const isReady = copied || copyError;

  return (
    <Box flexDirection="column">
      {showBanner && (
        <>
          <Banner />
          <Divider />
        </>
      )}

      <Box marginTop={1} marginLeft={1} gap={1}>
        {copied && (
          <>
            <Text color={colors.success} bold>{"+"}</Text>
            <Text color={colors.success} bold>Copied to clipboard!</Text>
            <Text color={colors.muted}>Paste it into your IDE chat.</Text>
          </>
        )}
        {copyError && (
          <>
            <Text color={colors.warning}>{"~"}</Text>
            <Text color={colors.warning}>Could not copy to clipboard.</Text>
            <Text color={colors.muted}>Copy the prompt below manually.</Text>
          </>
        )}
        {!copied && !copyError && (
          <Text color={colors.muted}>Copying to clipboard...</Text>
        )}
      </Box>

      <PromptBox>{prompt}</PromptBox>

      {onComplete && isReady && (
        <ContinuePrompt
          onContinue={() => onComplete({ prompt, copied })}
        />
      )}
    </Box>
  );
}

export function runPromptCommand(options: { stdout?: boolean }): void {
  const prompt = buildPrompt(process.cwd());

  if (options.stdout) {
    process.stdout.write(prompt + "\n");
    return;
  }

  render(<PromptApp showBanner={true} />);
}
