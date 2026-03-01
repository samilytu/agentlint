const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`
  );
  process.exit(1);
}

import { Command } from "commander";

import { registerInitCommand } from "./commands/init.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerPromptCommand } from "./commands/prompt.js";
import { redirectLogsToStderr } from "./utils.js";

async function main(): Promise<void> {
  redirectLogsToStderr();

  const program = new Command();

  program
    .name("agent-lint")
    .description("Meta-agent orchestrator for AI coding agent context artifacts")
    .version("0.2.0")
    .showHelpAfterError();

  registerInitCommand(program);
  registerDoctorCommand(program);
  registerPromptCommand(program);

  const argv = process.argv.slice(2);
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;

  try {
    await program.parseAsync([process.argv[0], process.argv[1], ...normalizedArgv]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}

void main();
