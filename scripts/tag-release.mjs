import { execFileSync } from "node:child_process";
import process from "node:process";

const PACKAGES = [
  {
    name: "@agent-lint/cli",
    path: "packages/cli/package.json",
    tagPrefix: "cli-v",
  },
  {
    name: "@agent-lint/mcp",
    path: "packages/mcp/package.json",
    tagPrefix: "mcp-v",
  },
];

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function parsePackageVersion(ref, filePath) {
  const raw = git(["show", `${ref}:${filePath}`]);
  return JSON.parse(raw).version;
}

function releaseRemote(token) {
  const server = process.env.CI_SERVER_HOST ?? "gitlab.com";
  const projectPath = process.env.CI_PROJECT_PATH ?? "bsamilozturk/agentlint";
  return `https://oauth2:${encodeURIComponent(token)}@${server}/${projectPath}.git`;
}

function remoteTagExists(tagName) {
  const output = git(["ls-remote", "--tags", "origin", `refs/tags/${tagName}`]);
  return output.length > 0;
}

function main() {
  if (process.env.CI_COMMIT_BRANCH && process.env.CI_COMMIT_BRANCH !== "main") {
    process.stderr.write("tag-release only runs on main.\n");
    return;
  }

  const previousSha = process.env.CI_COMMIT_BEFORE_SHA;
  if (!previousSha || /^0+$/.test(previousSha)) {
    process.stderr.write("No previous main commit available. Skipping tag generation.\n");
    return;
  }

  git(["fetch", "--tags", "origin"]);

  const tagsToCreate = [];
  for (const pkg of PACKAGES) {
    const previousVersion = parsePackageVersion(previousSha, pkg.path);
    const currentVersion = parsePackageVersion("HEAD", pkg.path);
    if (previousVersion === currentVersion) {
      continue;
    }

    tagsToCreate.push({
      packageName: pkg.name,
      tagName: `${pkg.tagPrefix}${currentVersion}`,
    });
  }

  if (tagsToCreate.length === 0) {
    process.stderr.write("No published package versions changed on this main commit.\n");
    return;
  }

  const token = process.env.GITLAB_RELEASE_TOKEN;
  if (!token) {
    process.stderr.write(
      "Version changes detected, but GITLAB_RELEASE_TOKEN is not set for pushing tags.\n",
    );
    process.exit(1);
  }

  const remote = releaseRemote(token);

  for (const tag of tagsToCreate) {
    if (remoteTagExists(tag.tagName)) {
      process.stderr.write(`${tag.tagName} already exists on origin. Skipping.\n`);
      continue;
    }

    git([
      "tag",
      "-a",
      tag.tagName,
      "-m",
      `Release ${tag.packageName} ${tag.tagName}`,
    ]);
    execFileSync("git", ["push", remote, `refs/tags/${tag.tagName}`], {
      stdio: "inherit",
    });
  }
}

main();
