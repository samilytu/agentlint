import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { SectionTitle } from "./components.js";
import { colors } from "./theme.js";
import type { MenuCommand } from "./main-menu.js";

export type NextActionChoice = MenuCommand | "menu";

export interface NextActionContext {
  /** Which command just completed */
  completedCommand: MenuCommand;
  /** Whether init created new configs (vs all already existed) */
  initCreatedConfigs?: boolean;
  /** Whether a doctor report file exists */
  hasReport?: boolean;
}

export interface NextActionProps {
  context: NextActionContext;
  onSelect: (choice: NextActionChoice) => void;
}

interface ActionOption {
  label: string;
  value: NextActionChoice;
}

export function buildNextActions(context: NextActionContext): ActionOption[] {
  const { completedCommand, initCreatedConfigs, hasReport } = context;
  const options: ActionOption[] = [];

  switch (completedCommand) {
    case "init":
      if (initCreatedConfigs) {
        options.push({ label: "Get IDE prompt (recommended)", value: "prompt" });
        options.push({ label: "Scan workspace (doctor)", value: "doctor" });
      } else {
        options.push({ label: "Scan workspace (recommended)", value: "doctor" });
        options.push({ label: "Get IDE prompt (prompt)", value: "prompt" });
      }
      break;

    case "doctor":
      if (hasReport === false) {
        options.push({ label: "Scan workspace again (recommended)", value: "doctor" });
        options.push({ label: "Get IDE prompt (prompt)", value: "prompt" });
      } else {
        options.push({ label: "Get IDE prompt (recommended)", value: "prompt" });
        options.push({ label: "Set up MCP config (init)", value: "init" });
      }
      break;

    case "prompt":
      if (!hasReport) {
        options.push({ label: "Scan workspace (recommended)", value: "doctor" });
        options.push({ label: "Set up MCP config (init)", value: "init" });
      } else {
        options.push({ label: "Scan workspace (doctor)", value: "doctor" });
        options.push({ label: "Set up MCP config (init)", value: "init" });
      }
      break;

    default:
      options.push({ label: "Set up MCP config (init)", value: "init" });
      options.push({ label: "Scan workspace (doctor)", value: "doctor" });
      options.push({ label: "Get IDE prompt (prompt)", value: "prompt" });
      break;
  }

  options.push({ label: "Back to menu", value: "menu" });
  options.push({ label: "Exit", value: "exit" });

  return options;
}

export function NextAction({ context, onSelect }: NextActionProps): React.ReactNode {
  const options = buildNextActions(context);

  return (
    <Box flexDirection="column">
      <SectionTitle>{"What's next?"}</SectionTitle>
      <Box marginLeft={3} marginBottom={0}>
        <Text color={colors.dim} italic>
          {"↑/↓ navigate · enter confirm"}
        </Text>
      </Box>
      <Box marginLeft={3} marginTop={0}>
        <Select
          options={options}
          onChange={(value) => onSelect(value as NextActionChoice)}
        />
      </Box>
    </Box>
  );
}
