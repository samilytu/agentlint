---
name: code-quality-review
description: Review Agent Lint changes for strict TypeScript, docs consistency, and safe public-surface updates. Use when reviewing code changes, tightening implementation quality, or checking if docs/tests/context must change together. Trigger on "review", "lint", "typecheck", "docs consistency", "public surface".
disable-model-invocation: false
activation-mode: on-request
scope: code-review
input-types:
  - code-change
  - review-request
  - quality-audit
outputs:
  - review-findings
  - fix-list
  - verification-checklist
safety-tier: standard
category: code-quality-review
version: 1
---

# Skill: Code Quality Review

## When to Use

Use this skill when:
- reviewing a PR or local diff in this repo
- checking strict TypeScript and lint compliance
- validating docs/tests/context alignment for public surface changes
- looking for risky regressions in CLI, MCP, core, or shared packages

## Purpose

Apply Agent Lint's repository-specific review standards so changes stay type-safe, testable, documented, and aligned with public behavior.

## Scope

### Included
- TypeScript correctness
- public-surface drift
- docs/test alignment
- context-artifact maintenance triggers
- package boundary and dependency-flow checks

### Excluded
- subjective style nitpicks without repository evidence
- unrelated product strategy decisions

## Inputs

- `diff-summary`
- `touched-files`
- `public-surface-change`: yes/no
- `review-goal`

## Step-by-step Execution

1. Read the touched files and classify them by package and responsibility.
2. Check dependency direction: `shared <- core <- mcp` and `shared <- core <- cli`.
3. Look for strict-typing violations, missing tests, stale docs, or public-surface drift.
4. If CLI commands, MCP tools/resources, or supported clients changed, require docs/test updates in the same change.
5. If structure/config/dependency changes occurred, call out context-artifact updates as part of review.
6. Return findings ordered by risk: correctness, release/doc drift, maintainability.

## Output Contract

Return:
- blocking findings
- non-blocking improvements
- files/docs/tests that must be updated
- exact verification commands

## Verification Commands

```bash
pnpm run build
pnpm run release-status
pnpm run typecheck
pnpm run lint
pnpm run test
```

## Evidence Format

- finding severity
- affected file(s)
- why it matters in Agent Lint specifically
- recommended fix
- verification command(s)

## Safety / DONTs

- Do not suggest `any`, `@ts-ignore`, or band-aid casts.
- Do not ignore docs consistency when public surface changes.
- Do not add MCP-side file writes or stateful behavior.
- Do not recommend skipping verification for package or client-facing changes.

## Gotchas

- Public-surface changes often require README and docs-consistency test updates together.
- Context maintenance artifacts can drift after structural changes even when runtime code still works.
- A "small" change in `shared` or `core` can affect both published packages.
- Repo-specific constraints matter more than generic review advice.
