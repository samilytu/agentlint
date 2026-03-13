import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { SectionTitle } from "./components.js";
import { colors } from "./theme.js";

// ── Types ──────────────────────────────────────────────────────────────

export type MenuCommand = "init" | "doctor" | "prompt" | "exit";

export interface MainMenuProps {
  onSelect: (command: MenuCommand) => void;
}

// ── Menu Options ────────────────────────────────────────────────────────

const menuOptions: { label: string; value: MenuCommand }[] = [
  { label: "Set up MCP config (init)", value: "init" },
  { label: "Scan workspace (doctor)", value: "doctor" },
  { label: "Get prompt (prompt)", value: "prompt" },
  { label: "Exit", value: "exit" },
];

// ── Component ───────────────────────────────────────────────────────────

export function MainMenu({ onSelect }: MainMenuProps): React.ReactNode {
  return (
    <Box flexDirection="column">
      <SectionTitle>What would you like to do?</SectionTitle>
      <Box marginLeft={3} marginBottom={0}>
        <Text color={colors.dim} italic>
          {"↑/↓ navigate · enter confirm"}
        </Text>
      </Box>
      <Box marginLeft={3} marginTop={0}>
        <Select
          options={menuOptions}
          onChange={(value) => onSelect(value as MenuCommand)}
        />
      </Box>
    </Box>
  );
}
