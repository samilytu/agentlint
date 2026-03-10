const PACKAGE_PREFIXES = [
  "packages/cli/",
  "packages/mcp/",
  "packages/shared/",
  "packages/core/",
];

const RELEASE_ARTIFACT_FILES = new Set([
  "CHANGELOG.md",
  "packages/cli/CHANGELOG.md",
  "packages/cli/package.json",
  "packages/mcp/CHANGELOG.md",
  "packages/mcp/package.json",
]);

const PUBLISHED_PACKAGE_FILE_PATTERNS = [
  /^packages\/(?:cli|mcp)\/README\.md$/u,
  /^packages\/(?:cli|mcp)\/LICENSE$/u,
];

const PACKAGE_BUILD_INPUT_PATTERNS = [
  /^packages\/(?:cli|mcp|shared|core)\/src\//u,
  /^packages\/(?:cli|mcp|shared|core)\/tsconfig\.json$/u,
  /^packages\/(?:cli|mcp|shared|core)\/tsup\.config\.ts$/u,
];

function normalizePath(file) {
  return file.replace(/\\/g, "/");
}

export function isChangesetFile(file) {
  const normalized = normalizePath(file);
  return (
    normalized.startsWith(".changeset/") &&
    normalized.endsWith(".md") &&
    normalized !== ".changeset/README.md"
  );
}

export function isReleaseArtifactOnly(file) {
  const normalized = normalizePath(file);
  return RELEASE_ARTIFACT_FILES.has(normalized) || isChangesetFile(normalized);
}

export function isPackageTestFile(file) {
  const normalized = normalizePath(file);
  return (
    normalized.includes("/tests/") ||
    normalized.endsWith(".test.ts") ||
    normalized.endsWith(".test.tsx") ||
    normalized.endsWith(".spec.ts") ||
    normalized.endsWith(".spec.tsx")
  );
}

export function affectsPublishedPackage(file) {
  const normalized = normalizePath(file);

  if (!PACKAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }

  if (isReleaseArtifactOnly(normalized) || isPackageTestFile(normalized)) {
    return false;
  }

  return (
    PUBLISHED_PACKAGE_FILE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    PACKAGE_BUILD_INPUT_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function getImpactfulFiles(changedFiles) {
  return changedFiles.filter(affectsPublishedPackage);
}
