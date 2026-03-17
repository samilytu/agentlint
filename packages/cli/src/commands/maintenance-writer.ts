import fs from "node:fs";
import path from "node:path";
import { buildMaintenanceSnippet, type MaintenanceSnippetResult } from "@agent-lint/core";
import type { McpClient } from "./clients.js";

type SupportedSnippetClient =
  | "cursor"
  | "windsurf"
  | "vscode"
  | "claude-code"
  | "generic";

export type MaintenanceInstallResult =
  | { status: "created"; targetPath: string }
  | { status: "updated"; targetPath: string }
  | { status: "appended"; targetPath: string }
  | { status: "exists"; targetPath: string }
  | { status: "skipped"; targetPath?: string; message: string }
  | { status: "error"; targetPath?: string; message: string };

type WriteMode = "append" | "replace";

const DEFAULT_LINE_ENDING = process.platform === "win32" ? "\r\n" : "\n";

const LEGACY_BULLET_RULES = [
  "Treat natural language requests about stale, missing, inconsistent, or low-quality AGENTS.md, CLAUDE.md, rules, skills, workflows, or plans as Agent Lint work even if the user does not name Agent Lint explicitly.",
  "Treat structural change signals such as new modules, new directories, dependency changes, CI/config updates, environment/security changes, or repository reorganization as reasons to check whether context artifacts need updates.",
  "For full workspace review or fix requests, start with agentlint_plan_workspace_autofix to scan the repository and produce the action plan.",
  "For targeted structural changes, call agentlint_quick_check with changed paths and/or a short change description before editing any context artifacts.",
  "Before creating or updating any AGENTS.md, CLAUDE.md, skills, rules, workflows, or plans file, call agentlint_get_guidelines for the artifact type to get the current specification.",
  "When the user wants ongoing upkeep, use agentlint_emit_maintenance_snippet where supported or append equivalent maintenance instructions to the main project context file.",
  "Apply recommended context artifact changes directly once Agent Lint has identified what to update.",
  "Keep context artifact files concise (under 10,000 characters). Reference external docs instead of duplicating content.",
] as const;

const LEGACY_HEADING_SNIPPET = [
  "# Agent Lint Context Maintenance",
  "",
  ...LEGACY_BULLET_RULES.map((rule) => `- ${rule}`),
].join("\n");

const LEGACY_BULLET_ONLY_SNIPPET = LEGACY_BULLET_RULES.map((rule) => `- ${rule}`).join("\n");

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createBackup(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
}

function resolveSnippetClient(client: McpClient): SupportedSnippetClient {
  switch (client.id) {
    case "cursor":
      return "cursor";
    case "windsurf":
      return "windsurf";
    case "vscode":
      return "vscode";
    case "claude-desktop":
    case "claude-code":
      return "claude-code";
    default:
      return "generic";
  }
}

function resolveGenericTargetPath(client: McpClient, cwd: string): string {
  const fileName = client.id === "claude-desktop" ? "CLAUDE.md" : "AGENTS.md";
  return path.join(cwd, fileName);
}

function resolveTarget(
  client: McpClient,
  cwd: string,
): { snippet: MaintenanceSnippetResult; targetPath: string; writeMode: WriteMode } {
  const snippetClient = resolveSnippetClient(client);
  const snippet = buildMaintenanceSnippet(snippetClient);

  if (snippetClient === "generic") {
    return {
      snippet,
      targetPath: resolveGenericTargetPath(client, cwd),
      writeMode: "append",
    };
  }

  return {
    snippet,
    targetPath: path.join(cwd, snippet.targetPath),
    writeMode: snippetClient === "cursor" || snippetClient === "windsurf"
      ? "replace"
      : "append",
  };
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function detectLineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : DEFAULT_LINE_ENDING;
}

function renderSnippet(snippet: string, lineEnding: string): string {
  const normalized = normalizeLineEndings(snippet);
  return `${normalized.replace(/\n/g, lineEnding)}${lineEnding}`;
}

function stripTrailingLineEndings(text: string): string {
  return text.replace(/(?:\r\n|\n)+$/u, "");
}

function matchesManagedSnippet(existing: string, snippet: string): boolean {
  return stripTrailingLineEndings(normalizeLineEndings(existing)) ===
    stripTrailingLineEndings(normalizeLineEndings(snippet));
}

function containsSnippet(existing: string, snippet: string): boolean {
  return normalizeLineEndings(existing).includes(normalizeLineEndings(snippet));
}

function replaceManagedAppendBlock(existing: string, nextSnippet: string): string | null {
  const normalizedExisting = normalizeLineEndings(existing);
  const normalizedNext = normalizeLineEndings(nextSnippet);
  const patterns = [
    /(^|\n)## Agent Lint Context Maintenance\n[\s\S]*?(?=\n##?\s+|\n#\s+|$)/u,
    /(^|\n)# Agent Lint Context Maintenance\n[\s\S]*?(?=\n#\s+|$)/u,
  ];

  for (const pattern of patterns) {
    if (pattern.test(normalizedExisting)) {
      return normalizedExisting.replace(pattern, (_match, prefix: string) =>
        `${prefix}${normalizedNext}`);
    }
  }

  if (normalizedExisting.includes(LEGACY_BULLET_ONLY_SNIPPET)) {
    return normalizedExisting.replace(LEGACY_BULLET_ONLY_SNIPPET, normalizedNext);
  }

  if (normalizedExisting.includes(LEGACY_HEADING_SNIPPET)) {
    return normalizedExisting.replace(LEGACY_HEADING_SNIPPET, normalizedNext);
  }

  return null;
}

function appendSnippet(existing: string, snippet: string, lineEnding: string): string {
  const endsWithLineEnding = /(?:\r\n|\n)$/u.test(existing);
  const endsWithBlankLine = /(?:(?:\r\n|\n)){2}$/u.test(existing);
  const separator = existing.length === 0
    ? ""
    : !endsWithLineEnding
      ? `${lineEnding}${lineEnding}`
      : !endsWithBlankLine
        ? lineEnding
        : "";

  return `${existing}${separator}${renderSnippet(snippet, lineEnding)}`;
}

export function installMaintenanceRule(client: McpClient, cwd: string): MaintenanceInstallResult {
  const { snippet, targetPath, writeMode } = resolveTarget(client, cwd);

  try {
    ensureDir(targetPath);

    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, renderSnippet(snippet.snippet, DEFAULT_LINE_ENDING), "utf-8");
      return { status: "created", targetPath };
    }

    const raw = fs.readFileSync(targetPath, "utf-8");
    const lineEnding = detectLineEnding(raw);

    if (writeMode === "replace") {
      if (matchesManagedSnippet(raw, snippet.snippet)) {
        return { status: "exists", targetPath };
      }

      createBackup(targetPath);
      fs.writeFileSync(targetPath, renderSnippet(snippet.snippet, lineEnding), "utf-8");
      return { status: "updated", targetPath };
    }

    if (containsSnippet(raw, snippet.snippet)) {
      return { status: "exists", targetPath };
    }

    const replaced = replaceManagedAppendBlock(raw, snippet.snippet);
    if (replaced !== null) {
      createBackup(targetPath);
      fs.writeFileSync(targetPath, renderSnippet(replaced, lineEnding), "utf-8");
      return { status: "updated", targetPath };
    }

    createBackup(targetPath);
    fs.writeFileSync(targetPath, appendSnippet(raw, snippet.snippet, lineEnding), "utf-8");
    return { status: "appended", targetPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      targetPath,
      message: `Failed to install maintenance rule for ${client.name}: ${message}`,
    };
  }
}
