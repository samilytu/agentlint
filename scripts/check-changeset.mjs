import { execFileSync } from "node:child_process";
import process from "node:process";
import {
  getImpactfulFiles,
  isChangesetFile,
  isReleaseArtifactOnly,
} from "./lib/changeset-impact.mjs";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key.startsWith("--")) {
      args.set(key, argv[index + 1]);
      index += 1;
    }
  }
  return args;
}

function resolveBaseRef(args) {
  const explicit = args.get("--base");
  if (explicit) {
    return explicit;
  }

  const diffBase = process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
  if (diffBase) {
    return diffBase;
  }

  const targetBranch = process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
  if (targetBranch) {
    git(["fetch", "origin", targetBranch]);
    return `origin/${targetBranch}`;
  }

  try {
    git(["fetch", "origin", "main"]);
    return "origin/main";
  } catch {
    return "HEAD";
  }
}

function listChangedFiles(baseRef) {
  if (baseRef === "HEAD") {
    return [];
  }

  const output = git(["diff", "--name-only", `${baseRef}...HEAD`]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseRef = resolveBaseRef(args);
  const changedFiles = listChangedFiles(baseRef);
  const isReleaseBranch =
    process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME === "release/next";

  if (changedFiles.length === 0) {
    process.stderr.write("No changed files detected. Skipping changeset check.\n");
    return;
  }

  if (isReleaseBranch && changedFiles.every(isReleaseArtifactOnly)) {
    process.stderr.write(
      "Release-only merge request detected. Changeset requirement skipped.\n",
    );
    return;
  }

  const impactfulFiles = getImpactfulFiles(changedFiles);
  if (impactfulFiles.length === 0) {
    process.stderr.write(
      "No published-package changes detected. Changeset requirement skipped.\n",
    );
    return;
  }

  const changedChangesets = changedFiles.filter(isChangesetFile);
  if (changedChangesets.length > 0) {
    process.stderr.write(
      `Changeset present: ${changedChangesets.join(", ")}\n`,
    );
    return;
  }

  process.stderr.write(
    [
      "Missing changeset for package-impacting changes.",
      "Add one with `pnpm changeset` before merging.",
      "Changed files:",
      ...impactfulFiles.map((file) => `- ${file}`),
    ].join("\n") + "\n",
  );
  process.exit(1);
}

main();
