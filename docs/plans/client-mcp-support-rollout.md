# Scope and Goals

- Bring Agent Lint CLI MCP client support to a level where the supported-client claim is accurate for Claude Code, Codex, Cursor, OpenCode, Windsurf, Claude Desktop, VS Code, Kilo Code, Cline, Roo Code, Kiro, and Zed.
- Ensure `agent-lint init` can detect each supported client and write the correct MCP config for the scopes that client actually supports.
- Align registry order, config payload shape, path resolution, docs, and tests with the final supported client matrix.
- Keep config writes idempotent, backup-safe, and format-correct for JSON and TOML clients.

# Non-Goals

- Do not add MCP runtime features beyond config installation and client detection.
- Do not weaken backup creation, config parsing, or maintenance-file safety.
- Do not claim support for a client without repo code, tests, and docs updated together.

# Current-State Assumptions

- `packages/cli/src/commands/clients.ts` is the source of truth for supported init clients.
- `packages/cli/src/commands/config-writer.ts` is the source of truth for file-based MCP config merge behavior.
- This rollout started with partial misalignment between repo support and latest vendor docs, especially for Claude Code and Kiro.
- This rollout started before Roo Code and Kilo Code were represented in `CLIENT_REGISTRY`.

# Risks and Dependencies

- Latest vendor docs may differ from older community examples, especially around workspace vs user config paths.
- Some clients may support multiple installation surfaces, requiring a deliberate product choice.
- Adding clients without tests can silently regress supported-client claims.
- Registry order is user-visible and must match the requested product ordering.

# Phases with Checklists

## Phase 0: Research and Matrix

- [x] Confirm latest MCP config locations, root keys, formats, and scope support for all requested clients.
- [x] Distinguish official support from inferred/community-only behavior.
- [x] Produce a final support matrix in requested display order.

## Phase 1: Registry and Detection

- [x] Update `CLIENT_REGISTRY` to the requested visible order.
- [x] Add any missing clients with explicit config format, root key, scopes, and detection signals.
- [x] Fix incorrect paths or scope models for existing clients.

## Phase 2: Config Writing

- [x] Ensure each client writes the correct MCP payload shape.
- [x] Ensure each client writes to the correct workspace/global path.
- [x] Keep CLI-based install behavior only where it is demonstrably correct and stable.
- [x] Add or adjust file-merge behavior for any new supported client formats.

## Phase 3: Test Coverage

- [x] Add registry-order coverage.
- [x] Add payload-shape coverage for all clients.
- [x] Add path/scope coverage for all clients.
- [x] Add init-flow coverage for newly supported or corrected clients.

## Phase 4: Docs and Surface Sync

- [x] Update root README client/support language.
- [x] Update `packages/cli/README.md` support table and notes.
- [x] Update package metadata and any docs-consistency tests affected by the new support matrix.

## Phase 5: Final Verification

- [x] Run targeted CLI tests.
- [x] Run root `typecheck`, `test`, `build`, and `lint`.
- [x] Run pack dry-runs for published packages.
- [x] Re-check final support claims against the completed code and docs.

# Verification Commands and Acceptance Criteria

- `pnpm exec vitest run packages/cli/tests/clients.test.ts`
- `pnpm exec vitest run packages/cli/tests/cli-stdout.test.ts packages/cli/tests/interactive-mode.test.ts`
- `pnpm exec vitest run packages/cli/tests/docs-consistency.test.ts packages/cli/tests/maintenance-writer.test.ts`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm run lint`
- `npm pack --dry-run` from `packages/cli`
- `npm pack --dry-run` from `packages/mcp`
- Acceptance criteria:
- Requested clients exist in the intended visible order.
- Each supported client has correct path, format, root key, and scope behavior.
- Docs describe only what the code and tests now support.

# Delivery Evidence

- Changed files should include the CLI registry, config writer, tests, and docs that describe support.
- Final evidence:
- Official docs were reviewed for Cursor, Windsurf, VS Code, Claude Code, Claude Desktop, Codex, OpenCode, Cline, Kiro, Roo Code, Kilo Code, and Zed.
- `packages/cli/src/commands/clients.ts` now includes the requested client order and adds `kilo-code` and `roo-code`.
- `packages/cli/src/commands/init.tsx` now prefers the official Claude Code CLI flow when available.
- `packages/cli/tests/clients.test.ts`, `packages/cli/tests/config-writer-simulation.test.ts`, and `packages/cli/tests/docs-consistency.test.ts` now cover order, detection, paths, scopes, and config output.
- `pnpm.cmd run typecheck`, `pnpm.cmd run test`, `pnpm.cmd run build`, `pnpm.cmd run lint`, CLI/MCP package dry-runs, and `agentlint_plan_workspace_autofix` passed.
- No requested client remains intentionally unsupported in the current CLI support matrix.
