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
    throw new Error(
      "GITHUB_MIRROR_TOKEN is required to mirror the default branch to GitHub.",
    );
  }

  const repository =
    process.env.GITHUB_MIRROR_REPOSITORY ?? "samilozturk/agentlint";
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${repository}.git`;
}

function ensureMirrorRemote(remoteName, remoteUrl) {
  const remotes = git(["remote"]);

  if (!remotes.split(/\r?\n/).includes(remoteName)) {
    git(["remote", "add", remoteName, remoteUrl]);
    return;
  }

  git(["remote", "set-url", remoteName, remoteUrl]);
}

function main() {
  const branchName = process.env.CI_COMMIT_BRANCH;
  const defaultBranch = process.env.CI_DEFAULT_BRANCH ?? "main";
  if (!branchName) {
    process.stderr.write("No CI_COMMIT_BRANCH set. Skipping GitHub branch mirror.\n");
    return;
  }

  if (branchName !== defaultBranch) {
    process.stderr.write(
      `Branch ${branchName} is not the default branch ${defaultBranch}. Skipping mirror.\n`,
    );
    return;
  }

  const remoteName = "github-mirror";
  ensureMirrorRemote(remoteName, githubRemoteUrl());

  const localSha = git(["rev-parse", "HEAD"]);
  const remoteRef = `refs/heads/${branchName}`;
  const remoteBranch = git(["ls-remote", "--heads", remoteName, remoteRef]);
  if (remoteBranch) {
    const [remoteSha] = remoteBranch.split(/\s+/);
    if (remoteSha === localSha) {
      process.stderr.write(
        `${branchName} already points to ${localSha} on GitHub. Skipping mirror.\n`,
      );
      return;
    }
  }

  execFileSync("git", ["push", remoteName, `HEAD:${remoteRef}`], {
    stdio: "inherit",
  });
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
