# Commit Conventions

Use the repository's conventional-commit style and keep each commit scoped to one intent.

## Preferred prefixes

- `fix(ci): ...` for GitLab, GitHub mirror, or release-script bug fixes
- `chore(release): prepare npm release` for the automated release-bot commit only
- `docs: ...` or `docs(release): ...` for release-doc updates
- `fix(cli): ...` or `fix(mcp): ...` for package-specific bug fixes
- `feat(cli): ...`, `feat(mcp): ...`, or `feat: ...` for new behavior
- `feat(... )!:` only when introducing a breaking public-surface change

## Repo-specific rules

- Match the subject to the staged diff; do not hide unrelated changes under a broad release or CI title.
- Prefer imperative summaries: `fix(ci): handle no-output git fetch in mirror job`.
- Use the narrowest useful scope: `cli`, `mcp`, `ci`, `release`, `docs`.
- Keep release-bot generated commits separate from manual follow-up fixes.
- Do not add `Co-authored-by` or AI attribution trailers unless the user explicitly asks.

## Before committing

1. Review `git diff --cached`.
2. Confirm the commit only contains one coherent change.
3. Check whether the change affects published package output.
4. If yes, add or confirm the matching changeset before pushing.

## Real examples from this repository

- `fix(ci): make github mirror lease-safe`
- `fix(ci): handle no-output git fetch in mirror job`
- `fix(cli): remove stale doctor references`
- `chore(release): prepare npm release`
