# Publishing Agent Lint

Agent Lint publishes two independently versioned packages:

- `@agent-lint/cli`
- `@agent-lint/mcp`

GitHub stays public-facing for docs and issues. GitLab CI is the only system that versions, tags, publishes, and mirrors releases.

## Release Flow

1. Ship code changes in a normal merge request.
2. Add a changeset with `pnpm changeset` if the change affects a published package.
3. Merge to `main`.
4. GitLab creates or updates a single `release/next` merge request with generated version and changelog changes.
5. Review and merge that release MR.
6. GitLab tags each changed package as `cli-vX.Y.Z` or `mcp-vX.Y.Z`.
7. GitLab publish jobs deploy from the protected `production` environment.
8. After a successful npm publish, GitLab mirrors the same package tag to GitHub.

Manual version edits and manual tag creation are no longer the normal path.

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
  - fine-grained GitHub token with tag push access to `samilytu/agentlint`
- `GITHUB_MIRROR_REPOSITORY`
  - optional override for the GitHub mirror target
  - defaults to `samilytu/agentlint`
- `NPM_TOKEN`
  - temporary fallback only while trusted publishing is being proven
  - remove it after trusted publishing succeeds consistently from `production`

## Protected Publish Environment

Create a GitLab protected environment named `production` and allow only the release maintainers to deploy to it.

The `publish-cli` and `publish-mcp` jobs target that environment. This is the approval gate for npm publish.

## npm Trusted Publishing

Trusted publishing is configured per npm package. Add a trusted publisher entry for each of:

- `@agent-lint/cli`
- `@agent-lint/mcp`

Use these settings:

- Provider: `GitLab`
- Namespace: `bsamilozturk`
- Project: `agentlint`
- CI config path: `.gitlab-ci.yml`
- Environment name: `production`

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

### GitLab CI

- enforce changesets on merge requests that affect published package outputs
- prepare and maintain the single `release/next` release MR
- create package-scoped release tags after the release MR merges
- publish to npm from the protected `production` environment
- mirror successful release tags to GitHub
