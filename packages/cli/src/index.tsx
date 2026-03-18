const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`,
  );
  process.exit(1);
}

import { render } from "ink";
import React from "react";
import { Command } from "commander";
import { runInitCommand } from "./commands/init.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runPromptCommand } from "./commands/prompt.js";
import { runScoreCommand } from "./commands/score.js";
import { redirectLogsToStderr } from "./utils.js";
import { VERSION } from "./ui/theme.js";
import { App, type AppProps } from "./app.js";
import type { MenuCommand } from "./ui/main-menu.js";

redirectLogsToStderr();

type EntryMode = "interactive" | "help" | "standalone";

function normalizeCliArgs(argv: string[]): string[] {
  return argv[0] === "--" ? argv.slice(1) : argv;
}

function resolveEntryMode(argv: string[], stdinIsTTY: boolean): EntryMode {
  if (argv.length > 0) {
    return "standalone";
  }
  return stdinIsTTY ? "interactive" : "help";
}

const NON_INTERACTIVE_FLAGS = new Set(["--stdout", "--json", "--help", "-h"]);
const TUI_COMMANDS = new Set<string>(["init", "doctor", "prompt"]);

interface ParsedTuiCommand {
  command: MenuCommand;
  appProps: AppProps;
}

export function parseTuiCommand(argv: string[]): ParsedTuiCommand | null {
  const [cmd, ...rest] = argv;
  if (!cmd || !TUI_COMMANDS.has(cmd)) {
    return null;
  }

  if (rest.some((flag) => NON_INTERACTIVE_FLAGS.has(flag))) {
    return null;
  }

  const command = cmd as MenuCommand;
  const appProps: AppProps = { initialCommand: command };

  if (command === "init") {
    const initOpts: { yes?: boolean; all?: boolean; withRules?: boolean } = {};
    for (const flag of rest) {
      if (flag === "--yes" || flag === "-y") initOpts.yes = true;
      else if (flag === "--all") initOpts.all = true;
      else if (flag === "--with-rules") initOpts.withRules = true;
      else return null;
    }
    if (initOpts.yes || initOpts.all || initOpts.withRules) {
      appProps.commandOptions = { init: initOpts };
    }
  } else if (command === "doctor") {
    const doctorOpts: { saveReport?: boolean } = {};
    for (const flag of rest) {
      if (flag === "--save-report") doctorOpts.saveReport = true;
      else return null;
    }
    if (doctorOpts.saveReport) {
      appProps.commandOptions = { doctor: doctorOpts };
    }
  } else if (rest.length > 0) {
    return null;
  }

  return { command, appProps };
}

function createProgram(): Command {
  const program = new Command();

  program
    .name("agent-lint")
    .description("Set up Agent Lint MCP config, scan for stale context files, and print prompts for your coding agent")
    .version(VERSION)
    .showHelpAfterError();

  program
    .command("init")
    .description("Set up Agent Lint MCP config and optionally install maintenance rules")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--all", "Generate configs for all supported clients, not just detected ones")
    .option("--with-rules", "Also install Agent Lint maintenance rules for the selected clients")
    .option("--stdout", "Print results to stdout instead of TUI")
    .action((options: { yes?: boolean; all?: boolean; withRules?: boolean; stdout?: boolean }) => {
      runInitCommand(options);
    });

  program
    .command("doctor")
    .description("Scan the workspace and generate a context maintenance report")
    .option("--stdout", "Print report to stdout instead of TUI")
    .option("--json", "Output discovery results as JSON")
    .option("--save-report", "Save report to .agentlint-report.md")
    .action((options: { stdout?: boolean; json?: boolean; saveReport?: boolean }) => {
      runDoctorCommand(options);
    });

  program
    .command("prompt")
    .description("Print a ready-to-paste IDE prompt for the next maintenance step")
    .option("--stdout", "Print prompt to stdout instead of TUI")
    .action((options: { stdout?: boolean }) => {
      runPromptCommand(options);
    });

  program
    .command("score <file>")
    .description("Score a context artifact against AgentLint's 12 quality dimensions")
    .option(
      "--type <type>",
      "Artifact type: agents, skills, rules, workflows, or plans (auto-detected from filename if omitted)",
    )
    .action((file: string, options: { type?: string }) => {
      runScoreCommand(file, options);
    });

  return program;
}

const normalizedArgv = normalizeCliArgs(process.argv.slice(2));
const entryMode = resolveEntryMode(normalizedArgv, process.stdin.isTTY === true);

if (entryMode === "interactive") {
  render(React.createElement(App));
} else if (entryMode === "standalone") {
  const tuiParsed = process.stdin.isTTY === true ? parseTuiCommand(normalizedArgv) : null;

  if (tuiParsed) {
    render(React.createElement(App, tuiParsed.appProps));
  } else {
    const program = createProgram();
    try {
      program.parse([process.argv[0], process.argv[1], ...normalizedArgv]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CLI error";
      process.stderr.write(`${message}\n`);
      process.exitCode = 2;
    }
  }
} else {
  const program = createProgram();
  const helpText = program.helpInformation();
  process.stdout.write(helpText.endsWith("\n") ? helpText : `${helpText}\n`);
  process.exitCode = 0;
}
