import { execFileSync } from "node:child_process";
import process from "node:process";
import { execPnpm } from "./lib/pnpm-runner.mjs";
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
    return null;
  }

  const remoteRef = `origin/${targetBranch}`;
  run("git", ["fetch", "origin", targetBranch], { stdio: "inherit" });
  return remoteRef;
}

function main() {
  const skipReason = getReleaseStatusSkipReason();
  if (skipReason) {
    process.stderr.write(`${skipReason}\n`);
    return;
  }

  const sinceRef = resolveSinceRef();
  const args = ["exec", "changeset", "status", "--verbose"];

  if (sinceRef) {
    args.push("--since", sinceRef);
  }

  execPnpm(args, {
    stdio: "inherit",
  });
}

main();
