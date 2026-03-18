import fs from "node:fs";
import path from "node:path";

import {
  artifactTypeValues,
  type ArtifactType,
  type ArtifactDiscoveryTier,
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
  staleReferences: string[];
  placeholderSections: string[];
  crossToolLeaks: string[];
  weakSignals: string[];
};

export type MissingArtifact = {
  type: ArtifactType;
  suggestedPath: string;
  reason: string;
  fallbackPaths: string[];
  canonicalPathDrift: boolean;
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
  discoveryTier: ArtifactDiscoveryTier;
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

const FALLBACK_MATCHERS: ArtifactMatcher[] = artifactTypeValues.flatMap((type: ArtifactType) =>
  getArtifactDiscoveryPatterns(type, "fallback").map((pattern: string) => ({
    type,
    regex: globToRegExp(pattern),
  })),
);

type HeadingRange = {
  normalizedHeading: string;
  contentLines: string[];
};

type ArtifactAnalysis = {
  missingSections: string[];
  staleReferences: string[];
  placeholderSections: string[];
  crossToolLeaks: string[];
  weakSignals: string[];
};

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bcoming soon\b/i,
  /\bfill (this|me|in)\b/i,
  /\bplaceholder\b/i,
  /\bto be added\b/i,
  /<[^>]+>/,
];

const COMMAND_PATTERNS = [
  /\bpnpm\s+(run\s+)?[a-z0-9:_-]+/i,
  /\bnpm\s+(run\s+)?[a-z0-9:_-]+/i,
  /\byarn\s+[a-z0-9:_-]+/i,
  /\bbun\s+(run\s+)?[a-z0-9:_-]+/i,
  /\bpytest\b/i,
  /\bvitest\b/i,
  /\beslint\b/i,
  /\btsc\b/i,
  /\bmake\s+[a-z0-9:_-]+/i,
  /\bcargo\s+(test|build|run)/i,
  /\bgo\s+(test|build|run)/i,
  /\bnode\s+[a-z0-9_.\\/:-]+/i,
  /\bnpx\s+[a-z0-9:_@./-]+/i,
  /\bpython(?:3)?\s+[a-z0-9_.\\/:-]+/i,
];

const CLAUDE_SPECIFIC_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\bCLAUDE\.md\b/, label: "CLAUDE.md" },
  { regex: /\bSKILL\.md\b/, label: "SKILL.md" },
  { regex: /\bAnthropic\b/i, label: "Anthropic" },
  { regex: /\bPreToolUse\b/, label: "PreToolUse" },
  { regex: /\bPostToolUse\b/, label: "PostToolUse" },
  { regex: /\bSubagentStop\b/, label: "SubagentStop" },
  { regex: /\b\.claude\//, label: ".claude/" },
  { regex: /\bmcpServers\b/, label: "mcpServers" },
];

const REPO_PATH_HINT_PATTERN =
  /^(?:@)?(?:\.{1,2}\/|(?:\.?[A-Za-z0-9_-]+\/)+|(?:AGENTS|CLAUDE|README|CONTRIBUTING|PUBLISH)\.md$|(?:package|tsconfig|vitest\.config|eslint\.config)\.[A-Za-z0-9._-]+$|(?:pnpm-workspace|pnpm-lock|package-lock|server)\.[A-Za-z0-9._-]+$|(?:\.[A-Za-z0-9_-]+\/)+)/;

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

function extractHeadingRanges(body: string): HeadingRange[] {
  const lines = body.split(/\r?\n/);
  const ranges: HeadingRange[] = [];
  let currentHeading: string | null = null;
  let currentContent: string[] = [];

  const pushCurrent = () => {
    if (!currentHeading) {
      return;
    }

    ranges.push({
      normalizedHeading: currentHeading,
      contentLines: [...currentContent],
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      pushCurrent();
      currentHeading = normalizeText(headingMatch[1]);
      currentContent = [];
      continue;
    }

    if (currentHeading) {
      currentContent.push(line);
    }
  }

  pushCurrent();
  return ranges;
}

function findMatchingHeadingRange(
  ranges: readonly HeadingRange[],
  requirement: SectionRequirement,
): HeadingRange | null {
  for (const range of ranges) {
    if (requirement.headingAliases.some((alias) => alias.test(range.normalizedHeading))) {
      return range;
    }
  }

  return null;
}

function hasRunnableCommand(lines: readonly string[]): boolean {
  return lines.some((line) => COMMAND_PATTERNS.some((pattern) => pattern.test(line)));
}

function countChecklistItems(lines: readonly string[]): number {
  return lines.filter((line) => /^\s*(?:[-*+]|\d+\.)\s+/.test(line)).length;
}

function isPlaceholderOnlySection(lines: readonly string[]): boolean {
  const significantLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (significantLines.length === 0) {
    return true;
  }

  return significantLines.every((line) => PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(line)));
}

function isExternalReference(reference: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(reference) ||
    reference.startsWith("mailto:") ||
    reference.startsWith("#") ||
    reference.startsWith("agentlint://")
  );
}

function resolveRepoReference(
  rootPath: string,
  artifactFilePath: string,
  reference: string,
): string | null {
  const strippedReference = reference
    .replace(/^@/, "")
    .split("#")[0]
    .split("?")[0]
    .trim();

  if (
    strippedReference.length === 0 ||
    isExternalReference(strippedReference) ||
    path.isAbsolute(strippedReference) ||
    !REPO_PATH_HINT_PATTERN.test(strippedReference)
  ) {
    return null;
  }

  const resolved = /^(?:\.{1,2}\/)/.test(strippedReference)
    ? path.resolve(path.dirname(artifactFilePath), strippedReference)
    : path.resolve(rootPath, strippedReference);
  const relativeToRoot = normalizePath(path.relative(rootPath, resolved));
  if (relativeToRoot.startsWith("..")) {
    return null;
  }

  return resolved;
}

function stripLineReference(reference: string): string {
  return reference.replace(/(?::\d+)?(?:#L\d+(?:C\d+)?)?$/i, "");
}

function isLikelyInlineFileReference(reference: string): boolean {
  if (/(?::\d+|#L\d+(?:C\d+)?)$/i.test(reference.trim())) {
    return false;
  }

  const normalized = stripLineReference(reference.trim());
  if (normalized.length === 0) {
    return false;
  }

  if (/^(?:\.{1,2}\/)/.test(normalized)) {
    return true;
  }

  const baseName = path.posix.basename(normalized.replace(/\\/g, "/"));
  return /\.[a-z0-9]+$/i.test(baseName);
}

function findStaleReferences(
  rootPath: string,
  artifactFilePath: string,
  body: string,
): string[] {
  const staleReferences = new Set<string>();
  const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const codeSpanPattern = /`([^`\n]+)`/g;

  const maybeTrackReference = (rawReference: string) => {
    const resolved = resolveRepoReference(rootPath, artifactFilePath, rawReference);
    if (!resolved) {
      return;
    }

    if (!fs.existsSync(resolved)) {
      staleReferences.add(rawReference.replace(/^@/, "").trim());
    }
  };

  for (const match of body.matchAll(markdownLinkPattern)) {
    const reference = match[1];
    if (reference) {
      maybeTrackReference(reference);
    }
  }

  for (const match of body.matchAll(codeSpanPattern)) {
    const reference = match[1];
    if (reference && isLikelyInlineFileReference(reference)) {
      maybeTrackReference(reference);
    }
  }

  return [...staleReferences].sort();
}

function findCrossToolLeaks(body: string, relativePath: string): string[] {
  const normalizedRelativePath = normalizePath(relativePath);
  const isCursorRule = normalizedRelativePath.startsWith(".cursor/rules/");
  const isCopilotInstructions = normalizedRelativePath === ".github/copilot-instructions.md";
  const isWindsurfRule = normalizedRelativePath.startsWith(".windsurf/rules/");

  if (!isCursorRule && !isCopilotInstructions && !isWindsurfRule) {
    return [];
  }

  const leaks = new Set<string>();
  for (const pattern of CLAUDE_SPECIFIC_PATTERNS) {
    if (pattern.regex.test(body)) {
      leaks.add(pattern.label);
    }
  }

  return [...leaks].sort();
}

function buildArtifactAnalysis(
  rootPath: string,
  filePath: string,
  relativePath: string,
  type: ArtifactType,
  content: string,
  gitignoreContent: string,
): ArtifactAnalysis {
  const parsed = parseArtifactContent(content);
  const headings = extractHeadingTokens(parsed.body);
  const headingRanges = extractHeadingRanges(parsed.body);
  const frontmatterKeys = extractFrontmatterKeys(parsed.frontmatter);
  const bodyText = normalizeText(parsed.body);
  const required = REQUIRED_SECTIONS[type];

  const missingSections = required
    .filter((requirement) => !requirementIsSatisfied(requirement, headings, frontmatterKeys, bodyText))
    .map((requirement) => requirement.name);

  const placeholderSections = required
    .map((requirement) => {
      const range = findMatchingHeadingRange(headingRanges, requirement);
      if (!range) {
        return null;
      }

      return isPlaceholderOnlySection(range.contentLines) ? requirement.name : null;
    })
    .filter((value): value is string => value !== null);

  const weakSignals: string[] = [];
  for (const requirement of required) {
    const range = findMatchingHeadingRange(headingRanges, requirement);
    if (!range || isPlaceholderOnlySection(range.contentLines)) {
      continue;
    }

    if (
      ((requirement.name === "quick commands" && type === "agents") ||
        (requirement.name === "verification" &&
          (type === "agents" || type === "rules" || type === "workflows"))) &&
      !hasRunnableCommand(range.contentLines) &&
      countChecklistItems(range.contentLines) < 2
    ) {
      weakSignals.push(`${requirement.name} section lacks runnable commands`);
    }
  }

  if (
    /\bCLAUDE\.local\.md\b/.test(parsed.body) &&
    !/CLAUDE\.local\.md/i.test(gitignoreContent)
  ) {
    weakSignals.push("mentions CLAUDE.local.md without a matching .gitignore entry");
  }

  if (type === "skills") {
    const hasGotchas = headings.some((h) => /\bgotchas?\b|\bcaveats?\b/.test(h));
    if (!hasGotchas) {
      weakSignals.push("no gotchas section — add real-world failure notes as you encounter them");
    }

    const description =
      typeof parsed.frontmatter?.["description"] === "string"
        ? (parsed.frontmatter["description"] as string)
        : "";
    const hasTriggerLanguage =
      /\btriggers? on\b|\buse when\b|\binvoke when\b|\bactivates? (on|when)\b|\btrigger(ed)? (by|when)\b/i.test(
        description,
      );
    if (description.length > 0 && !hasTriggerLanguage) {
      weakSignals.push(
        "description should include trigger language (e.g. 'use when…', 'triggers on…')",
      );
    }

    const lineCount = content.split(/\r?\n/).length;
    if (lineCount > 200) {
      const skillDir = path.dirname(filePath);
      const hasSubFolders = ["references", "scripts", "assets", "lib"].some((sub) =>
        fs.existsSync(path.join(skillDir, sub)),
      );
      if (!hasSubFolders) {
        weakSignals.push(
          "skill exceeds 200 lines with no references/ or scripts/ sub-folder — consider progressive disclosure",
        );
      }
    }
  }

  return {
    missingSections,
    staleReferences: findStaleReferences(rootPath, filePath, parsed.body),
    placeholderSections,
    crossToolLeaks: findCrossToolLeaks(parsed.body, relativePath),
    weakSignals: [...new Set(weakSignals)].sort(),
  };
}

function matchArtifactCandidate(
  relativePath: string,
): { type: ArtifactType; discoveryTier: ArtifactDiscoveryTier } | null {
  for (const matcher of CANONICAL_MATCHERS) {
    if (matcher.regex.test(relativePath)) {
      return { type: matcher.type, discoveryTier: "canonical" };
    }
  }

  for (const matcher of FALLBACK_MATCHERS) {
    if (matcher.regex.test(relativePath)) {
      return { type: matcher.type, discoveryTier: "fallback" };
    }
  }

  return null;
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
    const candidate = matchArtifactCandidate(relativePath);

    if (!candidate) {
      continue;
    }

    results.push({
      filePath: fullPath,
      relativePath,
      type: candidate.type,
      discoveryTier: candidate.discoveryTier,
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
  const gitignorePath = path.join(resolvedRoot, ".gitignore");
  const gitignoreContent = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : "";

  collectCandidateFiles(resolvedRoot, resolvedRoot, 0, candidateFiles);

  candidateFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const discovered: DiscoveredArtifact[] = [];
  const foundTypes = new Set<ArtifactType>();
  const fallbackPathsByType = new Map<ArtifactType, string[]>();

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

    if (candidate.discoveryTier === "fallback") {
      const existingFallbackPaths = fallbackPathsByType.get(candidate.type) ?? [];
      existingFallbackPaths.push(candidate.relativePath);
      fallbackPathsByType.set(candidate.type, existingFallbackPaths);
      continue;
    }

    foundTypes.add(candidate.type);
    const analysis = buildArtifactAnalysis(
      resolvedRoot,
      candidate.filePath,
      candidate.relativePath,
      candidate.type,
      content,
      gitignoreContent,
    );

    discovered.push({
      filePath: candidate.filePath,
      relativePath: candidate.relativePath,
      type: candidate.type,
      exists: true,
      sizeBytes: stats.size,
      isEmpty: content.trim().length === 0,
      missingSections: analysis.missingSections,
      staleReferences: analysis.staleReferences,
      placeholderSections: analysis.placeholderSections,
      crossToolLeaks: analysis.crossToolLeaks,
      weakSignals: analysis.weakSignals,
    });
  }

  const missing: MissingArtifact[] = [];
  for (const type of artifactTypeValues) {
    if (!foundTypes.has(type)) {
      const fallbackPaths = (fallbackPathsByType.get(type) ?? []).sort();
      const canonicalPathDrift = fallbackPaths.length > 0;
      missing.push({
        type,
        suggestedPath: findSuggestedPath(type, resolvedRoot),
        reason: canonicalPathDrift
          ? `No canonical ${type} artifact found in the workspace. Fallback candidates were found and should be reviewed or migrated.`
          : `No canonical ${type} artifact found in the workspace.`,
        fallbackPaths,
        canonicalPathDrift,
      });
    }
  }

  return {
    rootPath: resolvedRoot,
    discovered,
    missing,
  };
}
