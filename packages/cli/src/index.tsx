const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`
  );
  process.exit(1);
}

import { Command } from "commander";
import { runInitCommand } from "./commands/init.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runPromptCommand } from "./commands/prompt.js";
import { redirectLogsToStderr } from "./utils.js";
import { VERSION } from "./ui/theme.js";

redirectLogsToStderr();

const program = new Command();

program
  .name("agent-lint")
  .description("Meta-agent orchestrator for AI coding agent context artifacts")
  .version(VERSION)
  .showHelpAfterError();

program
  .command("init")
  .description("Set up Agent Lint MCP config for detected IDE clients")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("--all", "Generate configs for all supported clients, not just detected ones")
  .option("--stdout", "Print results to stdout instead of TUI")
  .action((options: { yes?: boolean; all?: boolean; stdout?: boolean }) => {
    runInitCommand(options);
  });

program
  .command("doctor")
  .description("Scan workspace for context artifacts and generate a fix report")
  .option("--stdout", "Print report to stdout instead of writing a file")
  .option("--json", "Output discovery results as JSON")
  .action((options: { stdout?: boolean; json?: boolean }) => {
    runDoctorCommand(options);
  });

program
  .command("prompt")
  .description("Print a copy-paste prompt for your IDE chat to trigger autofix")
  .option("--stdout", "Print prompt to stdout instead of TUI")
  .action((options: { stdout?: boolean }) => {
    runPromptCommand(options);
  });

const argv = process.argv.slice(2);
const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;

try {
  program.parse([process.argv[0], process.argv[1], ...normalizedArgv]);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown CLI error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
