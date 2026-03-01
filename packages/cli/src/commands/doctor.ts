import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { buildWorkspaceAutofixPlan } from "@agent-lint/core";
import { writeStderr, writeStdout } from "../utils.js";

const REPORT_FILENAME = ".agentlint-report.md";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Scan workspace for context artifacts and generate a fix report")
    .option("--stdout", "Print report to stdout instead of writing a file")
    .option("--json", "Output discovery results as JSON")
    .action(async (options: { stdout?: boolean; json?: boolean }) => {
      const rootPath = process.cwd();

      writeStderr("Agent Lint doctor — scanning workspace...\n");

      const plan = buildWorkspaceAutofixPlan(rootPath);
      const { discoveryResult } = plan;

      writeStderr(
        `  Found ${discoveryResult.discovered.length} artifact(s), ${discoveryResult.missing.length} type(s) missing.\n\n`,
      );

      if (options.json) {
        writeStdout(JSON.stringify(discoveryResult, null, 2));
        return;
      }

      if (options.stdout) {
        writeStdout(plan.markdown);
        return;
      }

      const reportPath = path.join(rootPath, REPORT_FILENAME);
      fs.writeFileSync(reportPath, plan.markdown, "utf-8");
      writeStdout(`Report written to ${REPORT_FILENAME}\n`);
      writeStdout(
        `\nNext: Run \`agent-lint prompt\` to get a copy-paste prompt for your IDE.\n`,
      );
    });
}
