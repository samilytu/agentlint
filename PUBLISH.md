# Publishing Agent Lint

Agent Lint publishes two independently versioned packages:

- `@agent-lint/cli`
- `@agent-lint/mcp`

GitHub stays public-facing for docs and issues. GitLab CI is the control plane that versions, tags, publishes, mirrors `main` after successful verification, and mirrors release tags after npm publish succeeds.

## Release Flow

1. Ship code changes in a normal merge request.
2. Add a changeset with `pnpm changeset` if the change affects a published package.
3. Merge to `main`.
4. After the `main` pipeline passes, GitLab mirrors the new `main` commit to GitHub.
5. GitLab creates or updates a single `release/next` merge request with generated version and changelog changes.
6. Review and merge that release MR.
7. GitLab tags each changed package as `cli-vX.Y.Z` or `mcp-vX.Y.Z`.
8. A maintainer starts the publish job from the tag pipeline.
9. After a successful npm publish, GitLab mirrors the same package tag to GitHub.

Manual version edits and manual tag creation are no longer the normal path.

GitLab is the source of truth for `main`. Do not merge code directly on GitHub `main`; the mirror job uses `--force-with-lease` to restore GitHub to the exact GitLab history when they diverge.

## Release Ops Notes

- Use conventional commits that match the actual change: `fix(ci): ...` for CI or mirror fixes, `docs:` for release-doc updates, and reserve `chore(release): prepare npm release` for the automated release-bot flow.
- Do not add `Co-authored-by` or AI attribution trailers unless they are explicitly requested for that change.
- Add a changeset only when published package output changes under `packages/cli`, `packages/mcp`, `packages/core`, or `packages/shared`. Docs-only, skill-only, workflow-only, and CI-only fixes do not need one.
- If `mirror-main-branch` fails, classify the failure before changing remote state: helper-script crash, auth or secret issue, non-fast-forward drift, or GitHub branch-protection rejection.
- A green `release/next` merge-request pipeline does not prove the `main` branch mirror job passed; treat those as separate checks.

## Local Verification

Before opening a merge request:

```bash
pnpm install
pnpm run build
pnpm run release-status
pnpm run typecheck
pnpm run lint
pnpm run test
```

If you change package metadata or release logic, also verify tarballs:

```bash
cd packages/cli && npm pack --dry-run
cd ../mcp && npm pack --dry-run
```

## GitLab Variables and Secrets

Configure these GitLab CI/CD variables:

- `GITLAB_RELEASE_TOKEN`
  - dedicated project access token
  - minimum scope needed to push `release/next`, create tags, and open or update merge requests
- `GITHUB_MIRROR_TOKEN`
  - fine-grained GitHub token with branch and tag push access to `samilozturk/agentlint`
  - if the target repo contains `.github/workflows`, also grant read/write access for Workflows
- `GITHUB_MIRROR_REPOSITORY`
  - optional override for the GitHub mirror target
  - defaults to `samilozturk/agentlint`
- `NPM_TOKEN`
  - temporary fallback only while trusted publishing is being proven
  - remove it after trusted publishing succeeds consistently

## Free Tier Publish Gate

GitLab protected environments are a Premium feature. On GitLab Free, the publish gate is the manual `publish-cli` or `publish-mcp` job on each release tag pipeline.

Recommended repository protection on GitLab Free:

- protect the `main` branch
- protect the `cli-v*` and `mcp-v*` tag patterns
- keep `GITLAB_RELEASE_TOKEN`, `GITHUB_MIRROR_TOKEN`, and temporary `NPM_TOKEN` as masked project variables

## npm Trusted Publishing

Trusted publishing is configured per npm package. Add a trusted publisher entry for each of:

- `@agent-lint/cli`
- `@agent-lint/mcp`

Use these settings:

- Provider: `GitLab`
- Namespace: `bsamilozturk`
- Project: `agentlint`
- CI config path: `.gitlab-ci.yml`
- Environment name: leave blank

Current CI auth behavior:

- if `NPM_TOKEN` is present, GitLab can still publish with token-based auth
- if `NPM_TOKEN` is missing, GitLab uses npm trusted publishing and provenance
- token-based jobs support both plain and file-type `NPM_TOKEN`
- publish jobs exit cleanly if the exact version is already on npm

## GitHub and GitLab Responsibilities

### GitHub Actions

- verify-only
- install, build, typecheck, lint, test, and pack dry-runs
- validate package-scoped tags after they are mirrored back from GitLab
- never publish to npm
- do not become an alternate merge path for `main`

### GitLab CI

- enforce changesets on merge requests that affect published package outputs
- mirror the default branch to GitHub after a successful push pipeline on `main`
- prepare and maintain the single `release/next` release MR
- create package-scoped release tags after the release MR merges
- wait for a maintainer to start the publish job from the tag pipeline
- mirror successful release tags to GitHub only after npm publish succeeds
- classify mirror failures before retrying: script/runtime, auth, branch drift, or branch protection
