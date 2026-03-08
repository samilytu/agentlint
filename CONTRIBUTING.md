# Contributing to Agent Lint

Agent Lint is a strict TypeScript monorepo for keeping coding-agent context artifacts aligned with a real codebase. This guide covers the current public product surface and the rules for changing it safely.

## Public Surface

- CLI package: `@agent-lint/cli`
- MCP package: `@agent-lint/mcp`
- CLI commands: `init`, `doctor`, `prompt`
- MCP tools: `agentlint_get_guidelines`, `agentlint_plan_workspace_autofix`, `agentlint_quick_check`, `agentlint_emit_maintenance_snippet`

## Development Setup

```bash
git clone https://github.com/samilytu/agentlint.git
cd agentlint
pnpm install
```

## Verify Before Opening a PR

```bash
pnpm run build
pnpm run release-status
pnpm run typecheck
pnpm run lint
pnpm run test
```

If you touch package metadata or release logic, also run:

```bash
cd packages/cli && npm pack --dry-run
cd ../mcp && npm pack --dry-run
```

## Monorepo Layout

```text
packages/
  shared/    -> Shared schemas, parsers, conventions, and types
  core/      -> Guidelines, workspace discovery, quick checks, maintenance snippets
  mcp/       -> MCP server package
  cli/       -> CLI package
```

Dependency flow:

- `shared <- core <- mcp`
- `shared <- core <- cli`

## Working Rules

- Keep strict typing. No `any`.
- `console.log()` is banned. Use stderr logging only.
- The MCP server must remain read-only. It can guide the client agent, but it must not write repository files.
- Avoid stateful behavior. No database, cache, or singleton coordination layer.
- Minimize dependencies and keep published packages small.

## What Needs Extra Care

- Any change to CLI commands or flags must update the public READMEs and tests.
- Any change to MCP tools or resources must update the public READMEs and the docs consistency tests.
- Package versions, changelogs, tags, and publish workflows must stay aligned.
- GitHub is the public home. GitLab CI is the authoritative publish path. Do not reintroduce dual publish automation.
- Package versions and package changelogs are generated from Changesets through the GitLab release MR flow. Do not edit release versions by hand.

## Commit and PR Style

Use conventional commit messages when possible:

```text
feat(cli): add xyz
fix(mcp): align timeout handling
docs: refresh package readmes
chore(release): prepare cli-v0.4.1
```

Good PRs make the behavioral change and the public docs change in the same branch.

If the change can affect either published package, also add a changeset:

```bash
pnpm changeset
```

Changesets are required for changes under `packages/cli`, `packages/mcp`, `packages/shared`, or `packages/core` when they affect published package outputs. They are not required for docs-only, CI-only, or repo-maintenance changes that do not affect npm packages.

## Adding or Changing Product Surface

For a new CLI feature:

1. Update the command implementation and tests.
2. Update the CLI README and any root README references.
3. Re-run `npm pack --dry-run` for `packages/cli`.

For a new MCP tool or resource:

1. Update the runtime registration and tests.
2. Update the MCP README and any root README references.
3. Keep docs consistency tests green.

## Release Workflow

1. Make the code change and update tests/docs.
2. Run `pnpm changeset` if the change affects a published package.
3. Open a merge request to `main`.
4. GitLab verifies the changeset requirement and package dry-runs.
5. After merge, GitLab opens or updates the `release/next` merge request.
6. Merge the release MR after reviewing the generated version and changelog changes.
7. GitLab creates package-scoped tags, waits for protected `production` publish approval, publishes to npm, and mirrors the same tags to GitHub.

## Issues and Discussions

- Public docs and issue tracking: [GitHub](https://github.com/samilytu/agentlint)
- Authoritative publish pipeline: [GitLab](https://gitlab.com/bsamilozturk/agentlint)

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
