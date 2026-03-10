---
description: Prepare and verify an Agent Lint package release without bypassing changesets, docs, or GitLab-controlled publish steps.
argument-hint: "[cli|mcp|both]"
mode: manual
---

# Goal

- Prepare a release for `@agent-lint/cli`, `@agent-lint/mcp`, or both while keeping code, docs, tests, and release metadata aligned.

# Preconditions

- The branch already contains the intended code changes.
- You know whether the change affects `cli`, `mcp`, or both public packages.
- If published package output changed, a changeset exists or will be added before merge.
- Publish, tag, and mirror steps require explicit user or maintainer approval.

# Ordered Steps

1. Confirm the changed public surface from code first.
   - Check `packages/mcp/src/catalog.ts`, `packages/cli/src/commands/`, and the relevant package `package.json`.
2. Align docs with the code change.
   - Update `README.md`, `packages/mcp/README.md`, `packages/cli/README.md`, `CONTRIBUTING.md`, or `PUBLISH.md` when command, tool, resource, client, or release behavior changed.
3. Add release metadata when needed.
   - Run `pnpm changeset` if the change affects published package output in `packages/cli`, `packages/mcp`, `packages/core`, or `packages/shared`.
4. Run local verification before opening or updating the merge request.
   - Use the verification commands below.
5. Dry-run package contents if metadata, files, or release scripts changed.
   - Run `npm pack --dry-run` from `packages/cli` and `packages/mcp` as needed.
6. Hand off to the documented GitLab flow.
   - Merge to `main`, let GitLab maintain `release/next`, and publish only from the package-scoped tag pipeline after review.

# Failure Handling

- If docs consistency tests fail, reconcile README tables and package docs with the current code surface before retrying.
- If `npm pack --dry-run` includes unexpected files, fix the package `files` field or build output before publishing.
- If release metadata is missing, add the changeset instead of editing package versions by hand.
- If publish or tag work would change remote state and approval is missing, stop and ask the user before continuing.

# Verification and Evidence

- `pnpm run build`
- `pnpm run release-status`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test`
- `npm pack --dry-run` from `packages/cli` when CLI package output changed
- `npm pack --dry-run` from `packages/mcp` when MCP package output changed
- Evidence to report: changed package names, commands run, test result, pack result, and whether a changeset was added

# Safety Gates

- Do not edit release versions or package changelogs by hand.
- Do not create tags, publish to npm, or mirror branches without explicit approval.
- Do not bypass GitLab as the authoritative release control plane.
- Do not store tokens or publish secrets in repo files, scripts, or docs.
