import fs from "node:fs";
import path from "node:path";

import {
  artifactTypeValues,
  type ArtifactType,
  getArtifactPathHints,
  getArtifactDiscoveryPatterns,
  parseArtifactContent,
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

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

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

type SectionRequirement = {
  name: string;
  headingAliases: readonly RegExp[];
  frontmatterAliases?: readonly RegExp[];
  bodyAliases?: readonly RegExp[];
};

const REQUIRED_SECTIONS: Record<ArtifactType, readonly SectionRequirement[]> = {
  agents: [
    {
      name: "quick commands",
      headingAliases: [/\bquick commands?\b/, /\bcommand examples?\b/],
    },
    {
      name: "repo map",
      headingAliases: [
        /\brepo map\b/,
        /\brepository specific notes\b/,
        /\brepository notes\b/,
        /\brepo structure\b/,
        /\bproject structure\b/,
      ],
    },
    {
      name: "working rules",
      headingAliases: [
        /\bworking rules\b/,
        /\bchange protocol\b/,
        /\btooling policy\b/,
        /\boperating mode\b/,
        /\binput handling\b/,
      ],
    },
    {
      name: "verification",
      headingAliases: [
        /\bverification\b/,
        /\bverification checklist\b/,
        /\bverification commands?\b/,
        /\bdefinition of done\b/,
      ],
    },
    {
      name: "security",
      headingAliases: [
        /\bsecurity\b/,
        /\bsafety boundaries\b/,
        /\binjection resistance\b/,
        /\bsecret hygiene\b/,
      ],
    },
    {
      name: "do not",
      headingAliases: [
        /\bdo not\b/,
        /\bnon goals\b/,
        /\bout of scope\b/,
      ],
      bodyAliases: [/\bforbidden\b/, /\bdo not\b/],
    },
  ],
  skills: [
    {
      name: "purpose",
      headingAliases: [/\bpurpose\b/, /\bintent\b/],
    },
    {
      name: "scope",
      headingAliases: [/\bscope\b/, /\bactivation conditions\b/],
      frontmatterAliases: [/\bscope\b/],
    },
    {
      name: "inputs",
      headingAliases: [/\binputs?\b/],
      frontmatterAliases: [/\binput types\b/],
    },
    {
      name: "step",
      headingAliases: [/\bstep\b/, /\bprocedure\b/, /\bexecution\b/, /\bworkflow\b/],
    },
    {
      name: "verification",
      headingAliases: [/\bverification\b/, /\bcompletion criteria\b/],
    },
    {
      name: "safety",
      headingAliases: [/\bsafety\b/, /\bguardrails\b/, /\bsafety examples\b/],
      frontmatterAliases: [/\bsafety tier\b/],
    },
  ],
  rules: [
    {
      name: "scope",
      headingAliases: [/\bscope\b/, /\bin scope\b/, /\bout of scope\b/],
      frontmatterAliases: [/\bscope\b/, /\bactivation mode\b/],
    },
    {
      name: "do",
      headingAliases: [/^do$/, /\brequired workflow\b/, /\brequired behavior\b/],
    },
    {
      name: "don't",
      headingAliases: [/\bdon t\b/, /\bdo not\b/],
    },
    {
      name: "verification",
      headingAliases: [
        /\bverification\b/,
        /\bverification commands?\b/,
        /\breview checklist\b/,
        /\bevidence format\b/,
      ],
    },
    {
      name: "security",
      headingAliases: [/\bsecurity\b/, /\bguardrails\b/],
    },
  ],
  workflows: [
    {
      name: "goal",
      headingAliases: [/\bgoal\b/, /\bpurpose\b/],
    },
    {
      name: "preconditions",
      headingAliases: [/\bpreconditions\b/, /\binputs?\b/],
    },
    {
      name: "step",
      headingAliases: [/\bsteps?\b/, /\bordered steps\b/, /\bprocedure\b/],
    },
    {
      name: "failure",
      headingAliases: [/\bfailure\b/, /\bfailure handling\b/, /\bfailure modes\b/],
    },
    {
      name: "verification",
      headingAliases: [/\bverification\b/, /\bverification commands?\b/, /\bquality gates\b/],
    },
    {
      name: "safety",
      headingAliases: [/\bsafety\b/, /\bsafety checks?\b/, /\bguardrails\b/],
    },
  ],
  plans: [
    {
      name: "scope",
      headingAliases: [/\bscope\b/, /\bobjective\b/, /\bscope and goals\b/, /\bgoals?\b/],
    },
    {
      name: "non-goals",
      headingAliases: [/\bnon goals\b/, /\bout of scope\b/],
      bodyAliases: [/\bout of scope\b/],
    },
    {
      name: "risk",
      headingAliases: [/\brisk\b/, /\brisks and mitigations\b/, /\brisks and dependencies\b/],
    },
    {
      name: "phase",
      headingAliases: [/\bphases?\b/, /\btimeline\b/],
    },
    {
      name: "verification",
      headingAliases: [/\bverification\b/, /\bverification strategy\b/, /\bacceptance criteria\b/],
    },
    {
      name: "evidence",
      headingAliases: [/\bdelivery evidence\b/, /\bdone definition\b/, /\bsuccess criteria\b/, /\bhandoff\b/],
    },
  ],
};

const CANONICAL_MATCHERS: ArtifactMatcher[] = artifactTypeValues.flatMap((type: ArtifactType) =>
  getArtifactDiscoveryPatterns(type, "canonical").map((pattern: string) => ({
    type,
    regex: globToRegExp(pattern),
  })),
);

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const normalizedPattern = normalizePath(pattern);
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

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractHeadingTokens(body: string): string[] {
  const headings: string[] = [];
  const matches = body.matchAll(/^\s{0,3}#{1,6}\s+(.+?)\s*$/gmu);

  for (const match of matches) {
    const heading = match[1]?.trim();
    if (heading) {
      headings.push(normalizeText(heading));
    }
  }

  return headings;
}

function extractFrontmatterKeys(frontmatter: Record<string, unknown> | null): string[] {
  return Object.keys(frontmatter ?? {}).map((key) => normalizeText(key));
}

function hasAliasMatch(values: readonly string[], aliases: readonly RegExp[] | undefined): boolean {
  if (!aliases || aliases.length === 0) {
    return false;
  }

  return values.some((value) => aliases.some((alias) => alias.test(value)));
}

function requirementIsSatisfied(
  requirement: SectionRequirement,
  headings: readonly string[],
  frontmatterKeys: readonly string[],
  bodyText: string,
): boolean {
  if (hasAliasMatch(headings, requirement.headingAliases)) {
    return true;
  }

  if (hasAliasMatch(frontmatterKeys, requirement.frontmatterAliases)) {
    return true;
  }

  return requirement.bodyAliases?.some((alias) => alias.test(bodyText)) ?? false;
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
  const parsed = parseArtifactContent(content);
  const headings = extractHeadingTokens(parsed.body);
  const frontmatterKeys = extractFrontmatterKeys(parsed.frontmatter);
  const bodyText = normalizeText(parsed.body);
  const required = REQUIRED_SECTIONS[type];

  return required
    .filter((requirement) => !requirementIsSatisfied(requirement, headings, frontmatterKeys, bodyText))
    .map((requirement) => requirement.name);
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

    const relativePath = normalizePath(path.relative(rootPath, fullPath));
    const type = matchArtifactType(relativePath);

    if (!type) {
      continue;
    }

    results.push({
      filePath: fullPath,
      relativePath,
      type,
    });
  }
}

function findSuggestedPath(type: ArtifactType, rootPath: string): string {
  const canonicalHints = getArtifactPathHints(type).filter(
    (hint: (ReturnType<typeof getArtifactPathHints>)[number]) => hint.discoveryTier === "canonical",
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
