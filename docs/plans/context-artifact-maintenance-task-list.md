# Scope and Goals

- Turn the implementation plan into an ordered execution checklist with explicit dependencies and verification gates.
- Track what is already done, what is next, and what must not be skipped while updating context-artifact maintenance behavior.
- Keep the task order deterministic so snippet, tests, discovery logic, guidance wording, and docs move in a safe sequence.

# Non-Goals

- This file does not replace the higher-level implementation plan.
- This file does not define new product scope outside the approved maintenance work.
- This file does not authorize broad repo edits unrelated to context artifacts and their tightly-coupled docs/tests.

# Current-State Assumptions

- Root `AGENTS.md` is the baseline context policy.
- `packages/mcp/AGENTS.md` and `packages/cli/AGENTS.md` remain the only package-level AGENTS files unless new necessity appears.
- Managed maintenance artifacts currently exist for Cursor, Windsurf, and Copilot.
- CLI fallback behavior must preserve `CLAUDE.md` for Claude-family clients and `AGENTS.md` for all others.
- The current workflow still depends on `agentlint_get_guidelines`, `agentlint_plan_workspace_autofix`, `agentlint_quick_check`, and `agentlint_emit_maintenance_snippet`.

# Risks and Dependencies

- Doing wording updates before generator and parity work will recreate drift.
- Doing auto-apply tightening before discovery hardening can produce confident but wrong edits.
- Changing fallback or client behavior without tests and docs will break trust in the CLI installer.
- New plan docs under `docs/plans/` must themselves stay structurally valid plan artifacts.

# Phases with Checklists

## Phase 0: Completed Planning and Setup

- [x] Review repository evidence for CLI, MCP, shared conventions, and existing maintenance artifacts.
- [x] Review root and package AGENTS guidance before planning scoped changes.
- [x] Call Agent Lint plan guidelines before creating new plan artifacts.
- [x] Clarify architecture, fallback rules, trigger model, and scope boundaries with the user.
- [x] Decide that `maintenance-snippet.ts` will be the single source for managed maintenance content.
- [x] Decide that checked-in maintenance artifacts are canonical managed files, not disposable examples.
- [x] Decide that skills are optional and specialized, not the primary maintenance carrier.
- [x] Decide that package-level AGENTS coverage stays intentionally limited.
- [x] Create the implementation plan markdown artifact.
- [x] Create this detailed task list markdown artifact.
- [x] Run a post-edit workspace scan and mark the result here.
- [x] Confirm the new plan artifacts pass the current Agent Lint workspace scan with `OK` status.

## Phase 1: Canonical Snippet Refactor

- [x] Inventory every semantic rule currently present in `packages/core/src/maintenance-snippet.ts`.
- [x] Inventory every semantic rule present in checked-in managed artifacts.
- [x] Diff the two inventories and record drift categories: missing sections, wording mismatch, scope mismatch, verification mismatch, security mismatch.
- [x] Design a typed section model for maintenance content.
- [x] Move shared content into canonical section data.
- [x] Keep client renderers thin and format-only.
- [x] Add explicit support for user override wording.
- [x] Add explicit support for Claude-family fallback messaging.
- [x] Re-check for duplicated or contradictory language.
- [x] Update tests to assert section presence before asserting final string output.

## Phase 2: Managed Artifact and Writer Parity

- [x] Add tests that render each supported snippet client from the canonical source.
- [x] Add tests that compare generated Cursor output to `.cursor/rules/agentlint-maintenance.mdc`.
- [x] Add tests that compare generated Windsurf output to `.windsurf/rules/agentlint-maintenance.md`.
- [x] Add tests that compare generated VS Code output to the managed maintenance section in `.github/copilot-instructions.md`.
- [x] Extend writer tests for existing `CLAUDE.md` preference in Claude scenarios.
- [x] Extend writer tests for `AGENTS.md` fallback in non-Claude generic scenarios.
- [x] Extend writer tests for replace-vs-append semantics.
- [x] Extend writer tests for backup creation after replacement or append.
- [x] Extend writer tests for CRLF and LF preservation.
- [x] Add a short managed-artifact note in docs if the implementation changes how these files are maintained.

## Phase 3: Discovery and Validator Hardening

- [x] Review `packages/core/src/workspace-discovery.ts` canonical patterns and skip lists.
- [x] Confirm which false positives currently matter most in this repo.
- [x] Add test coverage for reports, fixtures, and unrelated docs not being targeted as canonical artifacts.
- [x] Add test coverage for valid plan/rule/agent documents not being mis-scored because of heading variants.
- [x] Introduce heading-aware or frontmatter-aware validation where safe.
- [x] Keep alias handling explicit and tested.
- [x] Re-run discovery tests against fixture workspaces.
- [x] Verify that new plan docs still pass discovery/completeness expectations.

## Phase 4: Trigger and Quick-Check Refinement

- [x] Review current `quick_check` triggers against the chosen structural-change-first policy.
- [x] Add or tighten signals for dependency, config, CI, environment, security, and directory changes.
- [x] Add user-override wording in result guidance where needed.
- [x] Ensure results distinguish default Agent Lint guidance from explicit user overrides.
- [x] Add tests for low-noise triggering on unrelated changes.
- [x] Add tests for high-confidence triggering on structural changes.

## Phase 5: Wording and Flow Alignment

- [x] Align MCP server instructions.
- [x] Align CLI prompt text.
- [x] Align plan-builder or maintenance markdown output that uses older language.
- [x] Keep strong wording limited to context artifacts.
- [x] Confirm no public surface now implies repo-wide auto-edit behavior.

## Phase 6: Minimal Docs Sync

- [x] Update root README only if behavior changed.
- [x] Update package READMEs only if behavior changed.
- [x] Update docs-consistency tests together with any changed public wording.
- [x] Re-check package-local AGENTS only if README or client behavior changes require it.

## Phase 7: Final Verification and Acceptance

- [x] Run targeted core tests.
- [x] Run targeted CLI tests.
- [x] Run targeted MCP tests.
- [x] Run root typecheck.
- [x] Run root test suite.
- [x] Run root build if code changed materially.
- [x] Run `agentlint_plan_workspace_autofix` after the final context-artifact edits.
- [x] Record which phases were completed and which were deferred.
- [x] Confirm no canonical context artifact is left stale or structurally incomplete.

# Verification Commands and Acceptance Criteria

- `pnpm exec vitest run packages/core/tests/maintenance-snippet.test.ts`
- `pnpm exec vitest run packages/core/tests/workspace-discovery.test.ts packages/core/tests/quick-check.test.ts`
- `pnpm exec vitest run packages/cli/tests/maintenance-writer.test.ts packages/cli/tests/clients.test.ts packages/cli/tests/docs-consistency.test.ts`
- `pnpm exec vitest run packages/mcp/tests/tools.test.ts packages/mcp/tests/docs-consistency.test.ts`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `agentlint_plan_workspace_autofix`
- Acceptance criteria:
- Every completed checkbox has corresponding code, doc, or test evidence.
- No client fallback rule regresses.
- No managed maintenance artifact can drift without test failure.
- No new context plan artifact is left missing required plan sections.

# Delivery Evidence

- Keep a short execution log in commit or PR notes: changed files, why they changed, and which phase they belonged to.
- Capture test commands actually run and whether they passed.
- Capture scan results after plan or context-artifact edits.
- Current execution log: created the phased implementation plan, the detailed task list, and the dikkat-edilecekler file; then ran `agentlint_plan_workspace_autofix` and got `OK` for all three new plan files.
- Current phase log: refactored `packages/core/src/maintenance-snippet.ts` into a section-based canonical model, updated `.cursor/rules/agentlint-maintenance.mdc`, `.windsurf/rules/agentlint-maintenance.md`, `.github/copilot-instructions.md`, updated Claude/Desktop fallback behavior in `packages/cli/src/commands/maintenance-writer.ts`, and passed the targeted maintenance tests.
- Phase 3 log: added heading-aware completeness validation and alias coverage in `packages/core/src/workspace-discovery.ts`, then passed the discovery and plan-builder tests.
- Phase 4 log: tightened `packages/core/src/quick-check.ts`, added low-noise and structural-signal tests, and passed the quick-check and MCP tools tests.
- Phase 5/6 log: aligned MCP, CLI prompt, plan-builder, `AGENTS.md`, and README wording with the bounded auto-apply contract; docs-consistency checks stayed green.
- Final verification note: `pnpm.cmd run test`, `pnpm.cmd run typecheck`, `pnpm.cmd run build`, and `pnpm.cmd run lint` passed. `pnpm.cmd run release-status` also passed after temporarily staging the new changeset file for verification, and the file was then unstaged again.
- Note any intentionally deferred items so they do not become silent drift.
