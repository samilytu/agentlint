import React, { useState, useEffect } from "react";
import fs from "node:fs";
import path from "node:path";
import { Box, Text, render } from "ink";
import clipboardy from "clipboardy";
import {
  Banner,
  ContinuePrompt,
  PromptBox,
  Hint,
  Divider,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";

const REPORT_FILENAME = ".agentlint-report.md";

const PROMPT_WITH_REPORT =
  "Read the file .agentlint-report.md in this project and execute the recommended context maintenance fixes. " +
  "Use the agentlint MCP tools (agentlint_get_guidelines, agentlint_plan_workspace_autofix) " +
  "for artifact-specific guidance before editing. Apply the changes directly.";

const PROMPT_WITHOUT_REPORT =
  "Run agentlint_plan_workspace_autofix to scan this project for agent context artifacts " +
  "(AGENTS.md, CLAUDE.md, rules, skills, workflows, and plans). Then execute the fix plan step by step. " +
  "Use agentlint_get_guidelines for each artifact type before editing. " +
  "Apply all changes directly.";

export interface PromptResult {
  prompt: string;
  hasReport: boolean;
  copied: boolean;
}

export interface PromptAppProps {
  /** When provided, called instead of process exit (embedded mode) */
  onComplete?: (result: PromptResult) => void;
  /** Whether to show banner (standalone mode). Default: true */
  showBanner?: boolean;
}

export function PromptApp({ onComplete, showBanner = true }: PromptAppProps): React.ReactNode {
  const rootPath = process.cwd();
  const reportPath = path.join(rootPath, REPORT_FILENAME);
  const hasReport = fs.existsSync(reportPath);
  const prompt = hasReport ? PROMPT_WITH_REPORT : PROMPT_WITHOUT_REPORT;

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    clipboardy
      .write(prompt)
      .then(() => setCopied(true))
      .catch(() => setCopyError(true));
  }, []);
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

      {hasReport ? (
        <Box marginLeft={3}>
          <Text color={colors.success} bold>{"+ "}</Text>
          <Text color={colors.muted}>
            Using report from {REPORT_FILENAME}
          </Text>
        </Box>
      ) : (
        <Hint>
          Run agent-lint doctor first to generate a detailed report for better results.
        </Hint>
      )}

      {onComplete && isReady && (
        <ContinuePrompt
          onContinue={() => onComplete({ prompt, hasReport, copied })}
        />
      )}
    </Box>
  );
}

export function runPromptCommand(options: { stdout?: boolean }): void {
  if (options.stdout) {
    const rootPath = process.cwd();
    const reportPath = path.join(rootPath, REPORT_FILENAME);
    const hasReport = fs.existsSync(reportPath);
    const prompt = hasReport ? PROMPT_WITH_REPORT : PROMPT_WITHOUT_REPORT;
    process.stdout.write(prompt + "\n");
    return;
  }

  render(<PromptApp showBanner={true} />);
}
