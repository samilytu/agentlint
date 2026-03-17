import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { SectionTitle } from "./components.js";
import { colors } from "./theme.js";
import type { MenuCommand } from "./main-menu.js";

export type NextActionChoice = MenuCommand | "menu";

export interface NextActionContext {
  completedCommand: MenuCommand;
  initCreatedConfigs?: boolean;
}

export interface NextActionProps {
  context: NextActionContext;
  onSelect: (choice: NextActionChoice) => void;
}

interface ActionOption {
  label: string;
  value: NextActionChoice;
}

interface NextActionGuidance {
  order: string;
}

export function buildNextActions(context: NextActionContext): ActionOption[] {
  const { completedCommand, initCreatedConfigs } = context;
  const options: ActionOption[] = [];

  switch (completedCommand) {
    case "init":
      if (initCreatedConfigs) {
        options.push({
          label: "Get prompt (recommended) - Generate the handoff prompt now that setup is ready.",
          value: "prompt",
        });
        options.push({
          label: "Scan workspace (doctor) - Run a full scan if you want a report before handing off.",
          value: "doctor",
        });
      } else {
        options.push({
          label: "Scan workspace (recommended) - Verify the current workspace before the next handoff.",
          value: "doctor",
        });
        options.push({
          label: "Get prompt (prompt) - Generate the handoff prompt after the scan is clear.",
          value: "prompt",
        });
      }
      break;

    case "doctor":
      options.push({
        label: "Get prompt (recommended) - Turn the scan results into a ready-to-use handoff prompt.",
        value: "prompt",
      });
      options.push({
        label: "Set up MCP config (init) - Refresh client config and maintenance files before continuing.",
        value: "init",
      });
      break;

    case "prompt":
      options.push({
        label: "Scan workspace (recommended) - Rescan the workspace after follow-up changes.",
        value: "doctor",
      });
      options.push({
        label: "Set up MCP config (init) - Set up or refresh MCP config if client wiring is still missing.",
        value: "init",
      });
      break;

    default:
      options.push({
        label: "Set up MCP config (init) - Install or refresh MCP config and maintenance rules.",
        value: "init",
      });
      options.push({
        label: "Scan workspace (doctor) - Scan the workspace for missing, stale, or weak context artifacts.",
        value: "doctor",
      });
      options.push({
        label: "Get prompt (prompt) - Generate the next maintenance handoff prompt.",
        value: "prompt",
      });
      break;
  }

  options.push({ label: "Back to menu", value: "menu" });
  options.push({ label: "Exit", value: "exit" });

  return options;
}

export function getNextActionGuidance(context: NextActionContext): NextActionGuidance {
  let order =
    "Recommended order from here: review the next suggested command, then return to the menu if you need a different path.";

  switch (context.completedCommand) {
    case "init":
      order = context.initCreatedConfigs
        ? "Recommended order from here: 1. prompt to continue with an agent, 2. doctor if you want a full workspace report."
        : "Recommended order from here: 1. doctor to verify the current workspace, 2. prompt to hand off the follow-up work.";
      break;
    case "doctor":
      order =
        "Recommended order from here: 1. prompt to act on the scan, 2. init only if MCP config still needs setup.";
      break;
    case "prompt":
      order =
        "Recommended order from here: 1. doctor to rescan after changes, 2. init only if client config is still missing.";
      break;
  }

  return {
    order,
  };
}

export function NextAction({ context, onSelect }: NextActionProps): React.ReactNode {
  const options = buildNextActions(context);
  const guidance = getNextActionGuidance(context);

  return (
    <Box flexDirection="column">
      <SectionTitle>{"What's next?"}</SectionTitle>
      <Box marginLeft={3} marginBottom={0}>
        <Text color={colors.dim} italic>
          {"up/down navigate - enter confirm"}
        </Text>
      </Box>
      <Box marginLeft={3} marginTop={1} flexDirection="column">
        <Text color={colors.muted}>{guidance.order}</Text>
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
