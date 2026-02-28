import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { analyzeArtifactMcpCore } from "@agent-lint/core";
import type { ArtifactType } from "@agent-lint/shared";
import { Command, InvalidArgumentError } from "commander";

import { formatScanJson, formatScanText, type ScanDisplayResult } from "../format.js";
import {
  inferArtifactType,
  logOperational,
  mergeCliOptions,
  parseArtifactType,
  parseFailBelowOption,
  writeStderr,
  writeStdout,
  CliUsageError,
  type CliGlobalOptions,
} from "../utils.js";

const DEFAULT_MAX_FILES = 25;
const MAX_SCAN_DEPTH = 7;
const SCAN_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".yaml", ".yml"]);
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build"]);

const ARTIFACT_PATTERNS = [
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)CLAUDE\.md$/i,
  /skill/i,
  /rule/i,
  /workflow|command/i,
  /plan|roadmap|backlog/i,
];

type ScanCommandOptions = {
  maxFiles?: number;
  type?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  failBelow?: number;
};

function parseMaxFiles(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("--max-files must be an integer >= 1");
  }
  return parsed;
}

function shouldScanFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCAN_EXTENSIONS.has(ext)) {
    return false;
  }

  const normalized = filePath.replace(/\\/g, "/");
  const basename = path.basename(filePath);
  return ARTIFACT_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(basename));
}

async function collectCandidateFiles(rootPath: string, maxFiles: number): Promise<string[]> {
  const matches: string[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }];

  while (queue.length > 0 && matches.length < maxFiles) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    let entries: Dirent<string>[];
    try {
      entries = await readdir(current.dir, { withFileTypes: true, encoding: "utf8" });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isDirectory()) {
        if (current.depth >= MAX_SCAN_DEPTH || SKIP_DIRS.has(entry.name)) {
          continue;
        }
        queue.push({ dir: fullPath, depth: current.depth + 1 });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (shouldScanFile(fullPath)) {
        matches.push(fullPath);
        if (matches.length >= maxFiles) {
          break;
        }
      }
    }
  }

  return matches;
}

function resolveType(filePath: string, content: string, explicitType?: string): ArtifactType | null {
  if (explicitType) {
    return parseArtifactType(explicitType);
  }

  return inferArtifactType(filePath, content);
}

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan a directory and analyze discovered artifact files")
    .argument("[dir]", "Workspace directory", process.cwd())
    .option("--max-files <count>", "Maximum number of files to scan", parseMaxFiles, DEFAULT_MAX_FILES)
    .option("--type <type>", "Explicit artifact type (applies to all scanned files)")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress operational logs")
    .option("--verbose", "Enable verbose output")
    .option("--fail-below <score>", "Fail with exit code 1 if score is below threshold", parseFailBelowOption)
    .action(async (dir: string, options: ScanCommandOptions) => {
      const globalOptions = mergeCliOptions(program.opts<CliGlobalOptions>(), options);
      const rootPath = path.resolve(dir);
      const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

      try {
        logOperational(`Scanning ${rootPath} (max ${maxFiles} files)...`, globalOptions);

        const files = await collectCandidateFiles(rootPath, maxFiles);
        logOperational(`Found ${files.length} candidate artifact files`, globalOptions);

        const results: ScanDisplayResult[] = [];
        for (const filePath of files) {
          let content: string;
          try {
            content = await readFile(filePath, "utf8");
          } catch {
            continue;
          }

          const artifactType = resolveType(filePath, content, options.type);
          if (!artifactType) {
            continue;
          }

          const analyzed = await analyzeArtifactMcpCore({
            type: artifactType,
            content,
          });

          results.push({
            filePath: path.relative(rootPath, filePath),
            type: artifactType,
            score: analyzed.result.score,
            warnings: analyzed.warnings,
          });
        }

        if (globalOptions.json) {
          writeStdout(formatScanJson(results));
        } else {
          writeStdout(formatScanText(results, { verbose: globalOptions.verbose }));
        }

        const threshold = globalOptions.failBelow;
        if (typeof threshold === "number" && results.some((result) => result.score < threshold)) {
          process.exitCode = 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown scan error";
        writeStderr(`scan failed: ${message}`);
        process.exitCode = error instanceof CliUsageError ? 2 : 1;
      }
    });
}
