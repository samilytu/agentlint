const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`
  );
  process.exit(1);
}

import { render } from "ink";
import React from "react";
import { Command } from "commander";
import { runInitCommand } from "./commands/init.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runPromptCommand } from "./commands/prompt.js";
import { redirectLogsToStderr } from "./utils.js";
import { VERSION } from "./ui/theme.js";
import { App } from "./app.js";

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

function createProgram(): Command {
  const program = new Command();

  program
    .name("agent-lint")
    .description("Set up Agent Lint MCP config, scan for stale context files, and print prompts for your coding agent")
    .version(VERSION)
    .showHelpAfterError();

  program
    .command("init")
    .description("Set up Agent Lint MCP config for supported IDE clients")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--all", "Generate configs for all supported clients, not just detected ones")
    .option("--stdout", "Print results to stdout instead of TUI")
    .action((options: { yes?: boolean; all?: boolean; stdout?: boolean }) => {
      runInitCommand(options);
    });

  program
    .command("doctor")
    .description("Scan the workspace and generate a context maintenance report")
    .option("--stdout", "Print report to stdout instead of writing a file")
    .option("--json", "Output discovery results as JSON")
    .action((options: { stdout?: boolean; json?: boolean }) => {
      runDoctorCommand(options);
    });

  program
    .command("prompt")
    .description("Print a ready-to-paste IDE prompt for the next maintenance step")
    .option("--stdout", "Print prompt to stdout instead of TUI")
    .action((options: { stdout?: boolean }) => {
      runPromptCommand(options);
    });

  return program;
}

const normalizedArgv = normalizeCliArgs(process.argv.slice(2));
const entryMode = resolveEntryMode(normalizedArgv, process.stdin.isTTY === true);

if (entryMode === "interactive") {
  render(React.createElement(App));
} else {
  const program = createProgram();

  if (entryMode === "help") {
    const helpText = program.helpInformation();
    process.stdout.write(helpText.endsWith("\n") ? helpText : `${helpText}\n`);
    process.exitCode = 0;
  } else {
    try {
      program.parse([process.argv[0], process.argv[1], ...normalizedArgv]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CLI error";
      process.stderr.write(`${message}\n`);
      process.exitCode = 2;
    }
  }
}
