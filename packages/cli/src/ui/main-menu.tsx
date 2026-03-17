import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { SectionTitle } from "./components.js";
import { colors } from "./theme.js";

export type MenuCommand = "init" | "doctor" | "prompt" | "exit";

export interface MainMenuProps {
  onSelect: (command: MenuCommand) => void;
}

const menuOptions: { label: string; value: MenuCommand }[] = [
  {
    label: "Set up MCP config (init) - Install or refresh MCP config and managed maintenance rules.",
    value: "init",
  },
  {
    label: "Scan workspace (doctor) - Scan the workspace for missing, stale, or weak context artifacts.",
    value: "doctor",
  },
  {
    label: "Get prompt (prompt) - Generate the handoff prompt after setup and scan results are clear.",
    value: "prompt",
  },
  { label: "Exit", value: "exit" },
];

export function MainMenu({ onSelect }: MainMenuProps): React.ReactNode {
  return (
    <Box flexDirection="column">
      <SectionTitle>What would you like to do?</SectionTitle>
      <Box marginLeft={3} marginBottom={0}>
        <Text color={colors.dim} italic>
          {"up/down navigate - enter confirm"}
        </Text>
      </Box>
      <Box marginLeft={3} marginTop={1} flexDirection="column">
        <Text color={colors.muted}>Start here if you are unsure:</Text>
        <Text color={colors.tertiary}>1. init -&gt; 2. doctor -&gt; 3. prompt</Text>
      </Box>
      <Box marginLeft={3} marginTop={1}>
        <Select
          options={menuOptions}
          onChange={(value) => onSelect(value as MenuCommand)}
        />
      </Box>
    </Box>
  );
}
