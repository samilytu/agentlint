# Scope and goals

- Audit Agent Lint CLI MCP client support independently from existing implementation assumptions.
- Verify supported clients against current vendor docs, actual local client installs, and real `pnpm run cli` behavior.
- Correct any mismatched path, scope, root-key, merge, or docs claims discovered during the audit.
- Finish with reproducible evidence that the supported matrix works on this machine and in automated tests.

# Non-goals

- Do not change MCP server runtime tools/resources unless the audit proves client config support depends on it.
- Do not broaden support claims for low-confidence clients without primary-source evidence.
- Do not overwrite user config blindly; preserve backup-safe and idempotent behavior.

# Current-state assumptions

- Source of truth for client support is `packages/cli/src/commands/clients.ts`.
- `packages/cli/src/commands/config-writer.ts` owns merge semantics and backup behavior.
- `pnpm run cli -- init --stdout` chooses `workspace` when available, otherwise `global`.
- Agent Lint guidance prompted this plan because client support, plans, and public maintenance surface changed together.

# Risks and dependencies

- Vendor docs and community examples may diverge, especially for editor-extension clients.
- Global config paths can differ by host editor and operating system.
- Empty placeholder config files can appear on real machines and must not break setup.
- Real-machine validation can surface user-specific config drift that tests do not cover.

# Phases with checklists

## Phase 0: Research baseline

- [x] Read repo evidence: registry, writer, init flow, tests, docs, existing plan docs.
- [x] Review current official/vendor docs where available for Claude Code, Codex, Cursor, Windsurf, VS Code, OpenCode, Kiro, Zed, Cline, Roo Code, and Kilo Code.
- [x] Separate high-confidence support claims from lower-confidence inferred ones.

## Phase 1: Correct proven registry mismatches

- [x] Confirm Codex officially supports both project `.codex/config.toml` and user `~/.codex/config.toml`.
- [x] Preserve Codex support as `workspace/global` so `init --stdout` keeps project-local installs when a workspace `.codex` directory exists.
- [x] Fix Kilo Code global path to VS Code globalStorage-based MCP settings.
- [x] Sync CLI README and tests with corrected support claims.

## Phase 2: Harden merge behavior

- [x] Audit real-machine failures from `pnpm run cli -- init --stdout`.
- [x] Fix empty existing JSON/TOML config handling so placeholder files do not fail setup.
- [x] Add regression tests for empty-file merge behavior.

## Phase 3: Real CLI validation

- [x] Detect actual installed clients/binaries on this machine.
- [x] Inspect actual config-file presence for supported clients.
- [x] Run `pnpm run cli -- init --stdout` in the repo and record outcomes.
- [x] Validate actual resulting entry shapes for Codex, Claude Code, Cursor, OpenCode, Windsurf, and VS Code.
- [x] Re-run live CLI validation after merge fix and confirm Antigravity no longer fails on empty file.

## Phase 4: Full verification

- [x] Run targeted client-path tests.
- [x] Run full CLI test suite.
- [x] Re-check working tree diff for only intended files.
- [x] Summarize residual risks and any still-low-confidence clients.

# Verification commands and acceptance criteria

- `pnpm exec vitest run packages/cli/tests/config-writer-per-client.test.ts packages/cli/tests/clients.test.ts`
- `pnpm exec vitest run packages/cli/tests/cli-commands-e2e.test.ts`
- `pnpm exec vitest run packages/cli/tests`
- `pnpm run cli -- init --stdout`
- Acceptance criteria:
- Codex writes to `.codex/config.toml` when workspace scope is selected and to `~/.codex/config.toml` when global scope is selected.
- Kilo Code global path resolves to VS Code global storage MCP settings.
- Empty existing JSON/TOML config files are merged successfully instead of throwing parse errors.
- Real machine config entries for Codex, Claude Code, Cursor, OpenCode, Windsurf, and VS Code match expected shapes.
- Public docs do not claim unsupported scopes for corrected clients.

# Delivery evidence

- Code changes: `packages/cli/src/commands/clients.ts`, `packages/cli/src/commands/config-writer.ts`
- Docs change: `packages/cli/README.md`
- Regression coverage: `packages/cli/tests/clients.test.ts`, `packages/cli/tests/config-writer-per-client.test.ts`, `packages/cli/tests/cli-commands-e2e.test.ts`
- Live validation evidence:
- `pnpm run cli -- init --stdout` detected and configured real installed clients on this machine.
- Actual config-entry shape checks passed for Codex, Claude Code, Cursor, OpenCode, Windsurf, and VS Code.
- Actual config-entry shape checks also passed for Antigravity after fixing empty-file merge handling.
- Full repo verification passed: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `pnpm run lint`.
- Remaining risk to call out explicitly if still unresolved: low-confidence vendor evidence for Antigravity and host-editor nuances for some extension-based clients.
