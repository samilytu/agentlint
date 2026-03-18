---
name: npm-publish-gitlab
description: Publish @agent-lint packages from GitLab CI with npm provenance. Use when publish jobs fail, trusted publishing is misconfigured, or you need to verify package release readiness. Trigger on "publish", "npm", "gitlab", "provenance", "trusted publishing".
disable-model-invocation: false
activation-mode: on-request
scope: release-publishing
input-types:
  - publish-failure
  - ci-log
  - release-readiness-check
outputs:
  - root-cause-summary
  - publish-readiness-plan
  - exact-verification-commands
safety-tier: elevated
category: cicd-deployment
version: 1
---

# Skill: npm Publish GitLab

## When to Use

Use this skill when:
- GitLab publish jobs fail for `@agent-lint/cli` or `@agent-lint/mcp`
- npm trusted publishing or provenance is misconfigured
- You need to verify whether a package is actually ready to publish
- You need to distinguish GitHub verification from GitLab publish responsibility

Do not use this skill for normal feature development or unrelated CI failures.

## Purpose

Diagnose and verify the Agent Lint GitLab-to-npm release path without changing release versions by hand or bypassing the established release flow.

## Scope

### Included
- `PUBLISH.md`, `CONTRIBUTING.md`, `.gitlab-ci.yml`, package metadata, and release scripts
- Trusted publishing / provenance troubleshooting
- Token-vs-trusted-publishing checks
- Package dry-run and release-readiness verification

### Excluded
- Manual version edits
- Manual tag creation as a normal workflow
- Unrelated application runtime debugging

## Inputs

- `failure-context`: error message, CI log snippet, or symptom
- `package-name`: `@agent-lint/cli` or `@agent-lint/mcp`
- `changed-files`: relevant release or package files
- `goal`: diagnose failure or verify readiness

## Step-by-step Execution

1. Read `PUBLISH.md`, `CONTRIBUTING.md`, and the relevant package `package.json`.
2. Confirm the expected release flow: merge -> `release/next` MR -> package-scoped tag -> manual publish job.
3. Identify whether the problem is:
   - trusted publishing / provenance
   - token auth fallback
   - missing changeset or package metadata drift
   - tarball or package contents mismatch
   - trying to publish an already-published exact version
4. Check release-readiness commands before proposing any fix.
5. If the issue is configuration-related, explain the minimum required setting or secret.
6. If the issue is process-related, explain which release step was skipped or violated.
7. Return a concise diagnosis, exact commands, and the safest next action.

## Output Contract

Provide:
- a 1-paragraph root-cause summary
- the exact repo files inspected
- a short verification checklist
- the safest next action

## Verification Commands

```bash
pnpm run build
pnpm run release-status
pnpm run typecheck
pnpm run lint
pnpm run test
npm pack --dry-run --workspace packages/cli
npm pack --dry-run --workspace packages/mcp
```

## Evidence Format

- failing job or log snippet
- release step that failed
- package affected
- config or process mismatch found
- commands run or recommended

## Safety / DONTs

- Do not edit release versions by hand.
- Do not create manual tags as the default path.
- Do not publish from GitHub Actions.
- Do not expose tokens or secret values.
- Do not bypass the GitLab-controlled release flow unless the user explicitly asks for a recovery procedure.

## Gotchas

- Trusted publishing is configured per npm package, not once globally.
- GitHub is verify-only; GitLab is the authoritative publish path.
- `NPM_TOKEN` is a temporary fallback and may mask trusted-publishing problems.
- Publish jobs may exit cleanly if the exact version already exists on npm.
