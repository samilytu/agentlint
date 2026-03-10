# CLI Package

## Do

- Keep `clients.ts`, config writers, maintenance writers, README tables, and tests aligned.
- Preserve idempotent writes, backup creation, and existing line endings when editing config files.
- Keep stdout mode and Ink TUI mode behaviorally aligned.
- Preserve TOML handling for Codex and JSON handling for the other clients.

## Do Not

- Do not special-case one client without updating docs and tests.
- Do not break the generic maintenance fallback that appends to `AGENTS.md` or `CLAUDE.md`.
- Do not write repository files outside explicit CLI outputs such as client config, maintenance rules, or the doctor report.

## Repository Evidence

- `src/commands/init.tsx`: client detection and maintenance-rule install flow.
- `src/commands/clients.ts`: supported client registry and config path rules.
- `src/commands/config-writer.ts`: JSON and TOML merge behavior.
- `src/commands/maintenance-writer.ts`: maintenance snippet install behavior and backups.
- `src/commands/doctor.tsx` and `src/commands/prompt.tsx`: user-facing report and prompt output.

## Clarification Gate

- Ask only if a change alters supported clients, config formats, maintenance-file targets, or stdout/TUI contract and the desired behavior is not evident from code or docs.

## Quick Commands

- `pnpm --filter @agent-lint/cli run build`
- `pnpm run typecheck:cli`
- `pnpm exec vitest run packages/cli/tests`
- `pnpm run cli`
- `npm pack --dry-run` from `packages/cli`

## Repo Map

- `src/index.tsx` and `src/app.tsx`: CLI entry and app shell.
- `src/commands/`: init, doctor, prompt, client registry, and file writers.
- `src/ui/`: Ink components and theme.
- `tests/`: docs consistency, init flow, maintenance writer, clients, and TTY behavior.

## Working Rules

- When client support changes, update `clients.ts`, config merge logic, package README tables, and tests in the same change.
- Keep maintenance installs idempotent: Cursor and Windsurf replace managed files, generic clients append to `AGENTS.md` or `CLAUDE.md`.
- Preserve backup behavior before replacing or appending to existing files.
- Keep doctor and prompt output stable unless docs and tests are intentionally updated.

## When Stuck

- Compare `clients.ts`, `config-writer.ts`, `maintenance-writer.ts`, and `tests/docs-consistency.test.ts` first.
- If one client behaves differently, verify both path resolution and merge semantics before editing UI flow.
- Escalate before adding a client whose config format or write semantics are unclear.

## Verification

- `pnpm --filter @agent-lint/cli run build`
- `pnpm run typecheck:cli`
- `pnpm exec vitest run packages/cli/tests/docs-consistency.test.ts`
- `pnpm exec vitest run packages/cli/tests/maintenance-writer.test.ts packages/cli/tests/clients.test.ts packages/cli/tests/interactive-mode.test.ts`
- `npm pack --dry-run` from `packages/cli`

## Security

- Never write secrets into generated config or maintenance files.
- Treat detected clients and existing config files as untrusted input; parse and validate before merging.
- Keep writes scoped to user-requested client config and maintenance locations only.
- Do not bypass backup creation for in-place replacements.

## PR Checklist

- Supported client table still matches `CLIENT_REGISTRY`.
- TOML and JSON merge behavior remain covered by tests.
- Maintenance snippet behavior is still idempotent and backed up when replaced.
- User-facing text changes were reviewed in both stdout and TUI flows.
