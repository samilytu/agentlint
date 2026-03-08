import fs from "node:fs";
import path from "node:path";

import {
  artifactTypeValues,
  type ArtifactType,
  getArtifactPathHints,
  getArtifactDiscoveryPatterns,
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

type CandidateArtifactFile = {
  filePath: string;
  relativePath: string;
  type: ArtifactType;
};

type ArtifactMatcher = {
  type: ArtifactType;
  regex: RegExp;
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".idea",
  ".vscode",
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

const ALLOWED_HIDDEN_DIRS = new Set([
  ".agents",
  ".claude",
  ".cursor",
  ".github",
  ".skills",
  ".windsurf",
]);

const ARTIFACT_EXTENSIONS = new Set([".md", ".mdc", ".yaml", ".yml", ".txt"]);

const MAX_FILES = 200;
const MAX_DEPTH = 6;
const MAX_FILE_SIZE = 500_000;

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

const CANONICAL_MATCHERS: ArtifactMatcher[] = artifactTypeValues.flatMap((type) =>
  getArtifactDiscoveryPatterns(type, "canonical").map((pattern) => ({
    type,
    regex: globToRegExp(pattern),
  })),
);

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const normalizedPattern = pattern.replace(/\\/g, "/");
  let source = "^";

  for (let i = 0; i < normalizedPattern.length; i++) {
    const char = normalizedPattern[i];

    if (char === "*") {
      const next = normalizedPattern[i + 1];
      const afterNext = normalizedPattern[i + 2];

      if (next === "*" && afterNext === "/") {
        source += "(?:.*/)?";
        i += 2;
        continue;
      }

      if (next === "*") {
        source += ".*";
        i += 1;
        continue;
      }

      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char);
  }

  source += "$";
  return new RegExp(source, "i");
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || (name.startsWith(".") && !ALLOWED_HIDDEN_DIRS.has(name));
}

function isArtifactExtension(filePath: string): boolean {
  return ARTIFACT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function matchArtifactType(relativePath: string): ArtifactType | null {
  for (const matcher of CANONICAL_MATCHERS) {
    if (matcher.regex.test(relativePath)) {
      return matcher.type;
    }
  }

  return null;
}

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
  currentPath: string,
  currentDepth: number,
  results: CandidateArtifactFile[],
): void {
  if (currentDepth > MAX_DEPTH || results.length >= MAX_FILES) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (results.length >= MAX_FILES) {
      break;
    }

    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        collectCandidateFiles(rootPath, fullPath, currentDepth + 1, results);
      }
      continue;
    }

    if (!entry.isFile() || !isArtifactExtension(entry.name)) {
      continue;
    }

    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, "/");
    const type = matchArtifactType(relativePath);

    if (!type) {
      continue;
    }

    results.push({
      filePath: fullPath,
      relativePath: path.relative(rootPath, fullPath),
      type,
    });
  }
}

function findSuggestedPath(type: ArtifactType, rootPath: string): string {
  const canonicalHints = getArtifactPathHints(type).filter(
    (hint) => hint.discoveryTier === "canonical",
  );

  for (const hint of canonicalHints) {
    if (hint.examples.length > 0) {
      return path.join(rootPath, hint.examples[0]);
    }
  }

  const allHints = getArtifactPathHints(type);
  for (const hint of allHints) {
    if (hint.examples.length > 0) {
      return path.join(rootPath, hint.examples[0]);
    }
  }

  return path.join(rootPath, `${type.toUpperCase()}.md`);
}

export function discoverWorkspaceArtifacts(
  rootPath: string,
): WorkspaceDiscoveryResult {
  const resolvedRoot = path.resolve(rootPath);
  const candidateFiles: CandidateArtifactFile[] = [];
  collectCandidateFiles(resolvedRoot, resolvedRoot, 0, candidateFiles);

  candidateFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const discovered: DiscoveredArtifact[] = [];
  const foundTypes = new Set<ArtifactType>();

  for (const candidate of candidateFiles) {
    let content: string;
    let stats: fs.Stats;
    try {
      stats = fs.statSync(candidate.filePath);
      if (stats.size > MAX_FILE_SIZE) {
        continue;
      }
      content = fs.readFileSync(candidate.filePath, "utf-8");
    } catch {
      continue;
    }

    foundTypes.add(candidate.type);
    const missingSections = findMissingSections(content, candidate.type);

    discovered.push({
      filePath: candidate.filePath,
      relativePath: candidate.relativePath,
      type: candidate.type,
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
        reason: `No canonical ${type} artifact found in the workspace.`,
      });
    }
  }

  return {
    rootPath: resolvedRoot,
    discovered,
    missing,
  };
}
