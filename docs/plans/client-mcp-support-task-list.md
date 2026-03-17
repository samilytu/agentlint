# Scope and Goals

- Track the detailed execution steps for expanding and correcting client MCP support in Agent Lint CLI.
- Keep the implementation ordered so vendor research, registry changes, write semantics, tests, and docs stay aligned.

# Non-Goals

- This file does not replace the implementation plan.
- This file does not authorize speculative support claims without code and tests.

# Current-State Assumptions

- The user-visible client order must be: Claude Code, Codex, Cursor, OpenCode, Windsurf, Claude Desktop, VS Code, Kilo Code, Cline, Roo Code, Kiro, Zed.
- `init` must both detect and install MCP config correctly for every supported client.

# Risks and Dependencies

- Client detection may differ from config-path support.
- Community docs may conflict with vendor docs.
- New clients may introduce path or payload formats not yet covered by current merge utilities.

# Phases with Checklists

## Phase 0: Research

- [x] Read vendor docs for Claude Code.
- [x] Read vendor docs for Codex.
- [x] Read vendor docs for Cursor.
- [x] Read vendor docs for OpenCode.
- [x] Read vendor docs for Windsurf.
- [x] Read vendor docs for Claude Desktop.
- [x] Read vendor docs for VS Code.
- [x] Read vendor docs for Kilo Code.
- [x] Read vendor docs for Cline.
- [x] Read vendor docs for Roo Code.
- [x] Read vendor docs for Kiro.
- [x] Read vendor docs for Zed.
- [x] Record exact path/root-key/scope expectations for each client.

## Phase 1: Registry and Detection

- [x] Reorder `CLIENT_REGISTRY` to the requested UI order.
- [x] Add Roo Code client entry if official MCP config format is sufficiently clear.
- [x] Add Kilo Code client entry if official MCP config format is sufficiently clear.
- [x] Fix Claude Code scope/path model.
- [x] Add Kiro workspace support.
- [x] Verify detection signals for every client.

## Phase 2: Config Payloads and Writes

- [x] Verify root JSON/TOML key for each client.
- [x] Verify per-client MCP entry shape for each client.
- [x] Update writer logic only where existing generic JSON/TOML merge is insufficient.
- [x] Preserve backups and idempotency.

## Phase 3: Test Expansion

- [x] Add requested order assertions.
- [x] Add new client payload tests.
- [x] Add new client path/scope tests.
- [x] Add simulated init/install checks for all clients.
- [x] Add docs-consistency coverage for supported client ordering if needed.

## Phase 4: Docs Sync

- [x] Update `packages/cli/README.md` supported IDE table.
- [x] Update root README support language if needed.
- [x] Update package metadata descriptions if the supported surface expands.

## Phase 5: Verification

- [x] Run targeted CLI tests.
- [x] Run root `typecheck`.
- [x] Run root `test`.
- [x] Run root `build`.
- [x] Run root `lint`.
- [x] Run package dry-runs.

# Verification Commands and Acceptance Criteria

- `pnpm exec vitest run packages/cli/tests/clients.test.ts packages/cli/tests/cli-stdout.test.ts packages/cli/tests/interactive-mode.test.ts`
- `pnpm exec vitest run packages/cli/tests/docs-consistency.test.ts packages/cli/tests/maintenance-writer.test.ts`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm run lint`
- Acceptance criteria:
- All requested clients are either fully implemented and documented, or explicitly called out as blocked by missing official config surface.
- No supported client has a mismatched path/root-key/payload relative to vendor docs.

# Delivery Evidence

- Keep this checklist updated as phases complete.
- Final notes should reference the files that implemented each client fix.
- Final execution log:
- `packages/cli/src/commands/clients.ts` now carries the requested order and support matrix.
- `packages/cli/src/commands/init.tsx` now uses the preferred Claude Code CLI path when available.
- `packages/cli/tests/config-writer-simulation.test.ts` validates real config creation for every supported client scope in a temp environment.
- `README.md` and `packages/cli/README.md` now match the supported-client order and surface.
