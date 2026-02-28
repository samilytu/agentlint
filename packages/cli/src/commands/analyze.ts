import { readFile } from "node:fs/promises";

import { analyzeArtifactMcpCore } from "@agent-lint/core";
import type { ArtifactType } from "@agent-lint/shared";
import { Command } from "commander";

import { formatAnalysisJson, formatAnalysisText } from "../format.js";
import {
  inferArtifactType,
  logOperational,
  mergeCliOptions,
  parseArtifactType,
  parseFailBelowOption,
  validateFileSize,
  writeStderr,
  writeStdout,
  CliUsageError,
  type CliGlobalOptions,
} from "../utils.js";

type AnalyzeCommandOptions = {
  type?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  failBelow?: number;
};

function resolveType(filePath: string, content: string, explicitType?: string): ArtifactType {
  if (explicitType) {
    return parseArtifactType(explicitType);
  }

  const inferred = inferArtifactType(filePath, content);
  if (!inferred) {
    throw new CliUsageError("Could not infer artifact type. Pass --type <type> explicitly.");
  }
  return inferred;
}

export function registerAnalyzeCommand(program: Command): void {
  program
    .command("analyze")
    .description("Analyze a single artifact file")
    .argument("<path>", "Path to artifact file")
    .option("--type <type>", "Explicit artifact type")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress operational logs")
    .option("--verbose", "Enable verbose output")
    .option("--fail-below <score>", "Fail with exit code 1 if score is below threshold", parseFailBelowOption)
    .action(async (filePath: string, options: AnalyzeCommandOptions) => {
      const globalOptions = mergeCliOptions(program.opts<CliGlobalOptions>(), options);

      try {
        await validateFileSize(filePath);
        const content = await readFile(filePath, "utf8");
        const artifactType = resolveType(filePath, content, options.type);

        logOperational(`Analyzing ${filePath} as ${artifactType}...`, globalOptions);

        const analyzed = await analyzeArtifactMcpCore({
          type: artifactType,
          content,
        });

        const result = {
          filePath,
          type: artifactType,
          output: analyzed,
        };

        if (globalOptions.json) {
          writeStdout(formatAnalysisJson(result));
        } else {
          writeStdout(formatAnalysisText(result, { verbose: globalOptions.verbose }));
        }

        if (typeof globalOptions.failBelow === "number" && analyzed.result.score < globalOptions.failBelow) {
          process.exitCode = 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown analysis error";
        writeStderr(`analyze failed: ${message}`);
        process.exitCode = error instanceof CliUsageError ? 2 : 1;
      }
    });
}
