import { artifactTypeValues, type ArtifactType } from "@agent-lint/shared";
import { InvalidArgumentError } from "commander";
import { lstat } from "node:fs/promises";
import util from "node:util";

export type CliGlobalOptions = {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  failBelow?: number;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function parseFailBelowOption(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new InvalidArgumentError("score must be a number between 0 and 100");
  }
  return parsed;
}

export function mergeCliOptions(
  baseOptions: CliGlobalOptions,
  overrideOptions: CliGlobalOptions,
): CliGlobalOptions {
  return {
    json: overrideOptions.json ?? baseOptions.json,
    quiet: overrideOptions.quiet ?? baseOptions.quiet,
    verbose: overrideOptions.verbose ?? baseOptions.verbose,
    failBelow: overrideOptions.failBelow ?? baseOptions.failBelow,
  };
}

const AGENT_FILE_PATTERN = /(^|\/)agents\.md$|(^|\/)claude\.md$/i;

export function inferArtifactType(filePath: string, content: string): ArtifactType | null {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const lowerContent = content.toLowerCase();

  if (AGENT_FILE_PATTERN.test(normalized)) {
    return "agents";
  }
  if (normalized.includes("skill")) {
    return "skills";
  }
  if (normalized.includes("rule")) {
    return "rules";
  }
  if (normalized.includes("workflow") || normalized.includes("command")) {
    return "workflows";
  }
  if (normalized.includes("plan") || normalized.includes("roadmap") || normalized.includes("backlog")) {
    return "plans";
  }

  if (lowerContent.includes("agents.md") || lowerContent.includes("claude.md")) {
    return "agents";
  }
  if (lowerContent.includes("required frontmatter") || lowerContent.includes("disable-model-invocation")) {
    return "skills";
  }
  if (lowerContent.includes("activation mode") || lowerContent.includes("do block")) {
    return "rules";
  }
  if (lowerContent.includes("ordered steps") || lowerContent.includes("preconditions")) {
    return "workflows";
  }
  if (lowerContent.includes("phase") || lowerContent.includes("acceptance criteria")) {
    return "plans";
  }

  return null;
}

export function parseArtifactType(value: string): ArtifactType {
  const normalized = value.toLowerCase().trim();
  if (artifactTypeValues.includes(normalized as ArtifactType)) {
    return normalized as ArtifactType;
  }

  throw new CliUsageError(
    `Invalid artifact type: ${value}. Expected one of: ${artifactTypeValues.join(", ")}`,
  );
}

export function redirectLogsToStderr(): void {
  console.log = (...args: unknown[]): void => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
  console.info = (...args: unknown[]): void => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
}

export function writeStdout(content: string): void {
  process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}

export function writeStderr(content: string): void {
  process.stderr.write(content.endsWith("\n") ? content : `${content}\n`);
}

export function logOperational(message: string, options: CliGlobalOptions): void {
  if (options.quiet) {
    return;
  }
  writeStderr(message);
}

/** Max file size for CLI input — 1MB matching Zod schema limit. */
export const MAX_INPUT_FILE_BYTES = 1_000_000;

export async function validateFileSize(filePath: string): Promise<void> {
  const stats = await lstat(filePath);
  if (stats.isSymbolicLink()) {
    throw new CliUsageError(`Refusing to follow symlink: ${filePath}`);
  }
  if (stats.size > MAX_INPUT_FILE_BYTES) {
    throw new CliUsageError(
      `File too large (${stats.size} bytes, max ${MAX_INPUT_FILE_BYTES}). Reduce content size or use MCP workspace scan.`,
    );
  }
}
