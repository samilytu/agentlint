import React, { useState, useEffect } from "react";
import { Box, Text, render } from "ink";
import clipboardy from "clipboardy";
import {
  Banner,
  ContinuePrompt,
  PromptBox,
  Divider,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";

const PROMPT =
  "Run agentlint_plan_workspace_autofix to scan this project for agent context artifacts " +
  "(AGENTS.md, CLAUDE.md, rules, skills, workflows, and plans). Then execute the fix plan step by step. " +
  "Use agentlint_get_guidelines for each artifact type before editing. " +
  "Apply safe context-artifact changes directly unless I explicitly want a different outcome, and tell me when Agent Lint guidance triggered the update.";

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

  useEffect(() => {
    clipboardy
      .write(PROMPT)
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

      <PromptBox>{PROMPT}</PromptBox>

      {onComplete && isReady && (
        <ContinuePrompt
          onContinue={() => onComplete({ prompt: PROMPT, copied })}
        />
      )}
    </Box>
  );
}

export function runPromptCommand(options: { stdout?: boolean }): void {
  if (options.stdout) {
    process.stdout.write(PROMPT + "\n");
    return;
  }

  render(<PromptApp showBanner={true} />);
}
