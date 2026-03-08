import { execFileSync } from "node:child_process";
import process from "node:process";

const RELEASE_BRANCH = "release/next";
const RELEASE_TITLE = "chore(release): prepare npm release";

function run(command, args, options = {}) {
  const result = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  return typeof result === "string" ? result.trim() : "";
}

function listPendingChangesets() {
  const output = run("git", ["ls-files", ".changeset"]);
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(
      (file) => file.endsWith(".md") && file !== ".changeset/README.md",
    );
}

function withReleaseRemote(token) {
  const server = process.env.CI_SERVER_HOST ?? "gitlab.com";
  const projectPath = process.env.CI_PROJECT_PATH ?? "bsamilozturk/agentlint";
  return `https://oauth2:${encodeURIComponent(token)}@${server}/${projectPath}.git`;
}

async function apiRequest(path, options = {}) {
  const token = process.env.GITLAB_RELEASE_TOKEN;
  if (!token) {
    throw new Error("GITLAB_RELEASE_TOKEN is required to update the release MR.");
  }

  const baseUrl = process.env.CI_API_V4_URL;
  const projectId = process.env.CI_PROJECT_ID;
  if (!baseUrl || !projectId) {
    throw new Error("CI_API_V4_URL and CI_PROJECT_ID are required in CI.");
  }

  const response = await fetch(
    `${baseUrl}/projects/${encodeURIComponent(projectId)}${path}`,
    {
      ...options,
      headers: {
        "content-type": "application/json",
        "private-token": token,
        ...(options.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitLab API ${response.status}: ${body}`);
  }

  return response.json();
}

async function ensureReleaseMr() {
  const mergeRequests = await apiRequest(
    `/merge_requests?state=opened&source_branch=${encodeURIComponent(
      RELEASE_BRANCH,
    )}&target_branch=main`,
  );

  const description = [
    "Automated release merge request generated from pending Changesets.",
    "",
    "Merged release MRs trigger package-scoped release tags from GitLab CI.",
  ].join("\n");

  if (Array.isArray(mergeRequests) && mergeRequests.length > 0) {
    const current = mergeRequests[0];
    await apiRequest(`/merge_requests/${current.iid}`, {
      method: "PUT",
      body: JSON.stringify({
        title: RELEASE_TITLE,
        description,
      }),
    });
    process.stderr.write(`Updated existing release MR !${current.iid}.\n`);
    return;
  }

  const created = await apiRequest("/merge_requests", {
    method: "POST",
    body: JSON.stringify({
      source_branch: RELEASE_BRANCH,
      target_branch: "main",
      title: RELEASE_TITLE,
      description,
      remove_source_branch: true,
      squash: false,
    }),
  });

  process.stderr.write(`Created release MR !${created.iid}.\n`);
}

async function main() {
  if (process.env.CI_COMMIT_BRANCH && process.env.CI_COMMIT_BRANCH !== "main") {
    process.stderr.write("prepare-release only runs on main.\n");
    return;
  }

  const pendingChangesets = listPendingChangesets();
  if (pendingChangesets.length === 0) {
    process.stderr.write("No pending changesets. Skipping release preparation.\n");
    return;
  }

  const token = process.env.GITLAB_RELEASE_TOKEN;
  if (!token) {
    process.stderr.write(
      "Pending changesets found, but GITLAB_RELEASE_TOKEN is not set.\n",
    );
    process.exit(1);
  }

  run("git", ["config", "user.name", process.env.RELEASE_BOT_NAME ?? "agent-lint release bot"]);
  run("git", ["config", "user.email", process.env.RELEASE_BOT_EMAIL ?? "release-bot@users.noreply.gitlab.com"]);
  run("git", ["fetch", "origin", "main"], { stdio: "ignore" });
  try {
    run("git", ["fetch", "origin", RELEASE_BRANCH], { stdio: "ignore" });
  } catch {
    process.stderr.write("release/next does not exist yet. Creating it.\n");
  }
  run("git", ["checkout", "-B", RELEASE_BRANCH]);

  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) {
    throw new Error("npm_execpath is not set; cannot invoke pnpm reliably.");
  }

  execFileSync(process.execPath, [pnpmEntrypoint, "exec", "changeset", "version"], {
    stdio: "inherit",
  });

  const changedFiles = run("git", ["status", "--porcelain"]);
  if (!changedFiles) {
    process.stderr.write("Changesets produced no release diff. Skipping.\n");
    return;
  }

  run("git", ["add", "-A"]);
  run("git", ["commit", "-m", RELEASE_TITLE]);
  execFileSync(
    "git",
    ["push", "--force-with-lease", withReleaseRemote(token), `HEAD:${RELEASE_BRANCH}`],
    {
      stdio: "inherit",
    },
  );

  await ensureReleaseMr();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
