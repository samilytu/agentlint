import { execFileSync } from "node:child_process";
import process from "node:process";

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
  const sinceRef = resolveSinceRef();
  const args = ["exec", "changeset", "status", "--verbose"];
  const pnpmEntrypoint = process.env.npm_execpath;

  if (!pnpmEntrypoint) {
    throw new Error("npm_execpath is not set; cannot invoke pnpm reliably.");
  }

  if (sinceRef) {
    args.push("--since", sinceRef);
  }

  execFileSync(process.execPath, [pnpmEntrypoint, ...args], {
    stdio: "inherit",
  });
}

main();
