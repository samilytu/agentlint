import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { writeStdout } from "../utils.js";

const REPORT_FILENAME = ".agentlint-report.md";

const PROMPT_WITH_REPORT =
  "Read the file .agentlint-report.md in this project and execute all recommended fixes. " +
  "Use the agentlint MCP tools (agentlint_get_guidelines, agentlint_plan_workspace_autofix) " +
  "for detailed guidelines on each artifact type. Ask me for confirmation before saving any changes.";

const PROMPT_WITHOUT_REPORT =
  "Run agentlint_plan_workspace_autofix to scan this project for AI agent context artifacts " +
  "(AGENTS.md, skills, rules, workflows, plans). Then execute the fix plan step by step. " +
  "Use agentlint_get_guidelines for each artifact type before editing. " +
  "Ask me for confirmation before saving any changes.";

export function registerPromptCommand(program: Command): void {
  program
    .command("prompt")
    .description("Print a copy-paste prompt for your IDE chat to trigger autofix")
    .action(async () => {
      const rootPath = process.cwd();
      const reportPath = path.join(rootPath, REPORT_FILENAME);
      const hasReport = fs.existsSync(reportPath);

      const prompt = hasReport ? PROMPT_WITH_REPORT : PROMPT_WITHOUT_REPORT;

      writeStdout(prompt);

      if (!hasReport) {
        writeStdout(
          "\n\nTip: Run `agent-lint doctor` first to generate a detailed report for better results.",
        );
      }
    });
}
