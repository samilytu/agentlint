const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVersion < 18) {
  process.stderr.write(
    `agent-lint requires Node.js >= 18. Current: ${process.versions.node}\n`
  );
  process.exit(1);
}

import { Command } from "commander";

import { registerAnalyzeCommand } from "./commands/analyze.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerScoreCommand } from "./commands/score.js";
import { parseFailBelowOption, redirectLogsToStderr } from "./utils.js";

async function main(): Promise<void> {
  redirectLogsToStderr();

  const program = new Command();

  program
    .name("agent-lint")
    .description("Static analysis and scoring for AI agent context artifacts")
    .version("0.1.0")
    .enablePositionalOptions()
    .passThroughOptions()
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress operational logs")
    .option("--verbose", "Enable verbose output")
    .option("--fail-below <score>", "Fail with exit code 1 if score is below threshold", parseFailBelowOption)
    .showHelpAfterError();

  registerAnalyzeCommand(program);
  registerScanCommand(program);
  registerScoreCommand(program);

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
