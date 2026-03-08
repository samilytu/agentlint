import { execFileSync } from "node:child_process";
import process from "node:process";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function githubRemoteUrl() {
  const token = process.env.GITHUB_MIRROR_TOKEN;
  if (!token) {
    throw new Error("GITHUB_MIRROR_TOKEN is required to mirror release tags to GitHub.");
  }

  const repository =
    process.env.GITHUB_MIRROR_REPOSITORY ?? "samilytu/agentlint";
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${repository}.git`;
}

function main() {
  const tagName = process.env.CI_COMMIT_TAG;
  if (!tagName) {
    process.stderr.write("No CI_COMMIT_TAG set. Skipping GitHub tag mirror.\n");
    return;
  }

  const remoteUrl = githubRemoteUrl();
  const remoteName = "github-mirror";
  const existingRemote = git(["remote"]);

  if (!existingRemote.split(/\r?\n/).includes(remoteName)) {
    git(["remote", "add", remoteName, remoteUrl]);
  } else {
    git(["remote", "set-url", remoteName, remoteUrl]);
  }

  const remoteTag = git([
    "ls-remote",
    "--tags",
    remoteName,
    `refs/tags/${tagName}`,
  ]);

  if (remoteTag.length > 0) {
    process.stderr.write(`${tagName} already exists on GitHub. Skipping mirror.\n`);
    return;
  }

  execFileSync(
    "git",
    ["push", remoteName, `refs/tags/${tagName}:refs/tags/${tagName}`],
    { stdio: "inherit" },
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
