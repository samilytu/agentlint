import fs from "node:fs";
import path from "node:path";

import {
  artifactTypeValues,
  type ArtifactType,
  getArtifactPathHints,
} from "@agent-lint/shared";

export type DiscoveredArtifact = {
  filePath: string;
  relativePath: string;
  type: ArtifactType;
  exists: true;
  sizeBytes: number;
  isEmpty: boolean;
  missingSections: string[];
};

export type MissingArtifact = {
  type: ArtifactType;
  suggestedPath: string;
  reason: string;
};

export type WorkspaceDiscoveryResult = {
  rootPath: string;
  discovered: DiscoveredArtifact[];
  missing: MissingArtifact[];
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "out",
  "coverage",
  ".agentlint-backup",
  "__pycache__",
  ".venv",
  "vendor",
  "target",
]);

const ARTIFACT_EXTENSIONS = new Set([".md", ".mdc", ".yaml", ".yml", ".txt"]);

const MAX_FILES = 200;
const MAX_DEPTH = 6;
const MAX_FILE_SIZE = 500_000;

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".");
}

function isArtifactExtension(filePath: string): boolean {
  return ARTIFACT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function inferArtifactType(filePath: string, content: string): ArtifactType | null {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const lowerContent = content.substring(0, 2000).toLowerCase();

  if (/agents\.md$/i.test(normalized) || /claude\.md$/i.test(normalized)) {
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
  if (
    normalized.includes("plan") ||
    normalized.includes("roadmap") ||
    normalized.includes("backlog")
  ) {
    return "plans";
  }

  if (lowerContent.includes("agents.md") || lowerContent.includes("claude.md")) {
    return "agents";
  }
  if (
    lowerContent.includes("disable-model-invocation") ||
    lowerContent.includes("required frontmatter")
  ) {
    return "skills";
  }
  if (lowerContent.includes("activation mode") || lowerContent.includes("do block")) {
    return "rules";
  }
  if (lowerContent.includes("ordered steps") || lowerContent.includes("preconditions")) {
    return "workflows";
  }
  if (
    lowerContent.includes("acceptance criteria") ||
    lowerContent.includes("## phases")
  ) {
    return "plans";
  }

  return null;
}

const REQUIRED_SECTIONS: Record<ArtifactType, string[]> = {
  agents: [
    "quick commands",
    "repo map",
    "working rules",
    "verification",
    "security",
    "do not",
  ],
  skills: [
    "purpose",
    "scope",
    "inputs",
    "step",
    "verification",
    "safety",
  ],
  rules: [
    "scope",
    "do",
    "don't",
    "verification",
    "security",
  ],
  workflows: [
    "goal",
    "preconditions",
    "step",
    "failure",
    "verification",
    "safety",
  ],
  plans: [
    "scope",
    "non-goals",
    "risk",
    "phase",
    "verification",
    "evidence",
  ],
};

function findMissingSections(
  content: string,
  type: ArtifactType,
): string[] {
  const lowerContent = content.toLowerCase();
  const required = REQUIRED_SECTIONS[type];
  return required.filter((section) => !lowerContent.includes(section));
}

function collectCandidateFiles(
  rootPath: string,
  currentDepth: number,
  results: string[],
): void {
  if (currentDepth > MAX_DEPTH || results.length >= MAX_FILES) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_FILES) {
      break;
    }

    const fullPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      if (
        !shouldSkipDir(entry.name) ||
        entry.name === ".cursor" ||
        entry.name === ".windsurf" ||
        entry.name === ".claude" ||
        entry.name === ".agents"
      ) {
        collectCandidateFiles(fullPath, currentDepth + 1, results);
      }
    } else if (entry.isFile() && isArtifactExtension(entry.name)) {
      results.push(fullPath);
    }
  }
}

function findSuggestedPath(type: ArtifactType, rootPath: string): string {
  const hints = getArtifactPathHints(type);
  if (hints.length > 0 && hints[0].examples.length > 0) {
    return path.join(rootPath, hints[0].examples[0]);
  }
  return path.join(rootPath, `${type.toUpperCase()}.md`);
}

export function discoverWorkspaceArtifacts(
  rootPath: string,
): WorkspaceDiscoveryResult {
  const resolvedRoot = path.resolve(rootPath);
  const candidatePaths: string[] = [];
  collectCandidateFiles(resolvedRoot, 0, candidatePaths);

  const discovered: DiscoveredArtifact[] = [];
  const foundTypes = new Set<ArtifactType>();

  for (const filePath of candidatePaths) {
    let content: string;
    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        continue;
      }
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const type = inferArtifactType(filePath, content);
    if (!type) {
      continue;
    }

    foundTypes.add(type);
    const missingSections = findMissingSections(content, type);

    discovered.push({
      filePath,
      relativePath: path.relative(resolvedRoot, filePath),
      type,
      exists: true,
      sizeBytes: stats.size,
      isEmpty: content.trim().length === 0,
      missingSections,
    });
  }

  const missing: MissingArtifact[] = [];
  for (const type of artifactTypeValues) {
    if (!foundTypes.has(type)) {
      missing.push({
        type,
        suggestedPath: findSuggestedPath(type, resolvedRoot),
        reason: `No ${type} artifact found in the workspace.`,
      });
    }
  }

  return {
    rootPath: resolvedRoot,
    discovered,
    missing,
  };
}
