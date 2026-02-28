import { readdir, readFile, lstat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { artifactTypeValues, type ArtifactType } from "@agent-lint/shared";
import {
  analyzeWorkspaceArtifactsInputSchema,
  type AnalyzeWorkspaceArtifactsInput,
} from "@agent-lint/shared";
import { analyzeArtifactMcpCore } from "@agent-lint/core";

import { asInputSchema, asToolHandler } from "./schema-compat.js";
import { toToolResult } from "./tool-result.js";

const DEFAULT_MAX_FILES = 25;
const MAX_SCAN_DEPTH = 7;
const MAX_FILE_BYTES = 300_000;

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".idea",
  ".vscode",
]);

type WorkspaceArtifactSummary = {
  filePath: string;
  type: ArtifactType;
  score: number;
  warnings: string[];
  confidence: number;
  fallbackUsed: boolean;
};

export type AnalyzeWorkspaceArtifactsToolOutput = {
  rootPath: string;
  analyzedCount: number;
  averageScore: number;
  findings: WorkspaceArtifactSummary[];
  skippedFiles: string[];
};

function shouldScanFile(filePath: string, includePatterns: RegExp[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (![".md", ".mdx", ".txt", ".yaml", ".yml"].includes(ext)) {
    return false;
  }

  const normalized = filePath.replace(/\\/g, "/");
  const basename = path.basename(filePath);
  const defaultPatterns: RegExp[] = [
    /(^|\/)AGENTS\.md$/i,
    /(^|\/)CLAUDE\.md$/i,
    /skill/i,
    /rules?/i,
    /workflow|command/i,
    /plan|roadmap|backlog/i,
  ];

  const patterns = includePatterns.length > 0 ? includePatterns : defaultPatterns;
  return patterns.some((pattern) => pattern.test(normalized) || pattern.test(basename));
}

function toRegexPatterns(values: string[] | undefined): RegExp[] {
  if (!values) {
    return [];
  }

  const patterns: RegExp[] = [];
  for (const value of values) {
    try {
      patterns.push(new RegExp(value, "i"));
    } catch {
      continue;
    }
  }

  return patterns;
}

function inferArtifactType(filePath: string, content: string): ArtifactType | null {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const lowerContent = content.toLowerCase();

  if (normalized.endsWith("agents.md") || normalized.endsWith("claude.md")) {
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

async function collectCandidateFiles(
  rootPath: string,
  includePatterns: RegExp[],
  maxFiles: number,
): Promise<string[]> {
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

      if (shouldScanFile(fullPath, includePatterns)) {
        matches.push(fullPath);
        if (matches.length >= maxFiles) {
          break;
        }
      }
    }
  }

  return matches;
}

export async function executeAnalyzeWorkspaceArtifactsTool(
  input: AnalyzeWorkspaceArtifactsInput,
): Promise<AnalyzeWorkspaceArtifactsToolOutput> {
  const rootPath = path.resolve(input.rootPath ?? process.cwd());
  const maxFiles = input.maxFiles ?? DEFAULT_MAX_FILES;
  const includePatterns = toRegexPatterns(input.includePatterns);
  const files = await collectCandidateFiles(rootPath, includePatterns, maxFiles);

  const findings: WorkspaceArtifactSummary[] = [];
  const skippedFiles: string[] = [];

  for (const filePath of files) {
    let fileStats: Awaited<ReturnType<typeof lstat>>;
    try {
      fileStats = await lstat(filePath);
    } catch {
      skippedFiles.push(`${path.relative(rootPath, filePath)} (lstat failed)`);
      continue;
    }

    // Skip symlinks per dikkat_edilecekler.md §3.1
    if (fileStats.isSymbolicLink()) {
      skippedFiles.push(`${path.relative(rootPath, filePath)} (symlink — skipped)`);
      continue;
    }
    if (fileStats.size > MAX_FILE_BYTES) {
      skippedFiles.push(`${path.relative(rootPath, filePath)} (too large)`);
      continue;
    }

    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      skippedFiles.push(`${path.relative(rootPath, filePath)} (read failed)`);
      continue;
    }

    const inferredType = inferArtifactType(filePath, content);
    if (!inferredType || !artifactTypeValues.includes(inferredType)) {
      skippedFiles.push(`${path.relative(rootPath, filePath)} (type not inferred)`);
      continue;
    }

    const analyzed = await analyzeArtifactMcpCore({
      type: inferredType,
      content,
      analysisEnabled: input.analysisEnabled,
    });

    findings.push({
      filePath: path.relative(rootPath, filePath),
      type: inferredType,
      score: analyzed.result.score,
      warnings: analyzed.warnings,
      confidence: analyzed.confidence,
      fallbackUsed: analyzed.fallbackUsed,
    });
  }

  const averageScore =
    findings.length === 0
      ? 0
      : Math.round(findings.reduce((sum, item) => sum + item.score, 0) / findings.length);

  return {
    rootPath,
    analyzedCount: findings.length,
    averageScore,
    findings,
    skippedFiles,
  };
}

export type RegisterAnalyzeWorkspaceArtifactsOptions = {
  enabled: boolean;
};

export function registerAnalyzeWorkspaceArtifactsTool(
  server: McpServer,
  options: RegisterAnalyzeWorkspaceArtifactsOptions,
): void {
  if (!options.enabled) {
    return;
  }

  server.registerTool(
    "analyze_workspace_artifacts",
    {
      title: "Analyze Workspace Artifacts",
      description:
        "Local-first workspace scanner. Use in local stdio sessions to discover and analyze AGENTS/rules/skills/workflows/plans files across a repository.",
      inputSchema: asInputSchema(analyzeWorkspaceArtifactsInputSchema),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    asToolHandler(async (args: AnalyzeWorkspaceArtifactsInput) => {
      try {
        const output = await executeAnalyzeWorkspaceArtifactsTool(args);
        return toToolResult({
          summary: `files=${output.analyzedCount} avgScore=${output.averageScore} skipped=${output.skippedFiles.length}`,
          structuredContent: output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toToolResult({
          summary: `analyze_workspace_artifacts failed: ${message}`,
          structuredContent: { error: message },
          isError: true,
        });
      }
    }),
  );
}
