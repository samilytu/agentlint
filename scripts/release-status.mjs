import { execFileSync } from "node:child_process";
import process from "node:process";
import { execPnpm } from "./lib/pnpm-runner.mjs";
import { getImpactfulFiles } from "./lib/changeset-impact.mjs";
import { getReleaseStatusSkipReason } from "./lib/release-status-context.mjs";

function run(command, args, options = {}) {
  const result = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  return typeof result === "string" ? result.trim() : "";
}

function resolveSinceRef() {
  if (process.env.CHANGESET_SINCE) {
    return process.env.CHANGESET_SINCE;
  }

  const targetBranch =
    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ??
    process.env.CI_DEFAULT_BRANCH;

  if (!targetBranch) {
    try {
      run("git", ["fetch", "origin", "main"], { stdio: "inherit" });
      return "origin/main";
    } catch {
      return null;
    }
  }

  const remoteRef = `origin/${targetBranch}`;
  run("git", ["fetch", "origin", targetBranch], { stdio: "inherit" });
  return remoteRef;
}

function listChangedFiles(baseRef) {
  if (!baseRef) {
    return [];
  }

  const output = run("git", ["diff", "--name-only", `${baseRef}...HEAD`]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function main() {
  const skipReason = getReleaseStatusSkipReason();
  if (skipReason) {
    process.stderr.write(`${skipReason}\n`);
    return;
  }

  const sinceRef = resolveSinceRef();
  const changedFiles = sinceRef ? listChangedFiles(sinceRef) : [];
  const impactfulFiles = getImpactfulFiles(changedFiles);

  if (changedFiles.length > 0 && impactfulFiles.length === 0) {
    process.stderr.write("No published-package changes detected. Skipping pending changeset status.\n");
    return;
  }

  const args = ["exec", "changeset", "status", "--verbose"];

  if (sinceRef) {
    args.push("--since", sinceRef);
  }

  execPnpm(args, {
    stdio: "inherit",
  });
}

main();
