import React, { useState, useEffect } from "react";
import fs from "node:fs";
import path from "node:path";
import { Box, Text, render } from "ink";
import clipboardy from "clipboardy";
import {
  Banner,
  PromptBox,
  Hint,
  Divider,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";

const REPORT_FILENAME = ".agentlint-report.md";

const PROMPT_WITH_REPORT =
  "Read the file .agentlint-report.md in this project and execute all recommended fixes. " +
  "Use the agentlint MCP tools (agentlint_get_guidelines, agentlint_plan_workspace_autofix) " +
  "for detailed guidelines on each artifact type. Apply all changes directly.";

const PROMPT_WITHOUT_REPORT =
  "Run agentlint_plan_workspace_autofix to scan this project for AI agent context artifacts " +
  "(AGENTS.md, skills, rules, workflows, plans). Then execute the fix plan step by step. " +
  "Use agentlint_get_guidelines for each artifact type before editing. " +
  "Apply all changes directly.";

function PromptApp(): React.ReactNode {
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

  return (
    <Box flexDirection="column">
      <Banner />
      <Divider />

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
    </Box>
  );
}

export function runPromptCommand(): void {
  render(<PromptApp />);
}
