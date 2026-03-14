# Scope and Goals

- Keep context artifacts aligned with the live codebase, supported clients, and explicit user instructions.
- Make root `AGENTS.md` the baseline source of truth, with package or client files acting as narrower overlays.
- Make `packages/core/src/maintenance-snippet.ts` the canonical generator for managed maintenance instructions.
- Keep strong auto-apply language only for context artifacts: `AGENTS.md`, `CLAUDE.md`, rules, skills, workflows, and plans.
- Reduce drift between snippets, checked-in managed artifacts, CLI install behavior, MCP guidance, and docs/tests.

# Non-Goals

- Adding new MCP tools, new CLI commands, or a large new skill catalog in this plan.
- Expanding package-level `AGENTS.md` beyond the currently necessary package boundaries.
- Making skills the primary maintenance layer.
- Turning Agent Lint into a generic repo-wide auto-editor outside context artifacts.

# Current-State Assumptions

- Public MCP surface remains four tools and three resources.
- Public CLI surface remains `init`, `doctor`, and `prompt`.
- Supported clients remain the current `CLIENT_REGISTRY`: Claude Code, Codex, Cursor, OpenCode, Windsurf, Claude Desktop, VS Code, Kilo Code, Cline, Roo Code, Kiro, and Zed.
- Claude-family clients prefer `CLAUDE.md`; all other clients prefer `AGENTS.md` as the generic context-file fallback.
- Root `AGENTS.md` stays primary; package/client files may add narrower constraints without replacing the root baseline.
- Checked-in managed artifacts are real repository artifacts, not loose examples.

# Risks and Dependencies

- Generator drift: `packages/core/src/maintenance-snippet.ts` can diverge from `.cursor/rules/agentlint-maintenance.mdc`, `.windsurf/rules/agentlint-maintenance.md`, and `.github/copilot-instructions.md`.
- Trigger drift: maintenance guidance can become too aggressive or too weak if `quick_check`, server instructions, and snippets are not updated together.
- Discovery false positives: workspace scans can target reports, fixtures, or non-canonical docs if path/section logic stays too loose.
- Client mismatch: CLI fallback, docs, and tests can drift if one client gets special-cased without full cross-surface updates.
- This work depends on `packages/core`, `packages/cli`, `packages/mcp`, root `AGENTS.md`, package READMEs, and docs-consistency tests staying aligned.

# Phases with Checklists

## Phase 0: Contract and Planning Baseline

- [x] Confirm the layered architecture: root `AGENTS.md` baseline, client-native overlays, optional skill/workflow support.
- [x] Confirm the precedence model: explicit user instruction, then local overlay, then root baseline, then default Agent Lint maintenance guidance.
- [x] Confirm fallback behavior: Claude-family -> `CLAUDE.md`; all other generic fallback cases -> `AGENTS.md`.
- [x] Confirm scope boundaries: strong auto-apply language applies only to context artifacts.
- [x] Capture this phased implementation plan in a dedicated markdown artifact.
- [x] Capture a detailed execution checklist in a dedicated markdown artifact.
- [x] Capture a dedicated dikkat-edilecekler checklist in a dedicated markdown artifact.
- [x] Run `agentlint_plan_workspace_autofix` and confirm the new plan artifacts are structurally valid.

## Phase 1: Canonical Maintenance Snippet Model

- [x] Replace the flat `CORE_RULES` list with a section-based content model.
- [x] Standardize shared sections across clients: Scope, Activation, Do, Don't, Verification, Security.
- [x] Add explicit wording for user override behavior without weakening the default Agent Lint guidance path.
- [x] Encode strong-but-bounded auto-apply language so it never expands beyond context artifacts.
- [x] Separate semantic content from client-specific formatting and target-path selection.
- [x] Preserve current install semantics: managed replace for Cursor/Windsurf, append for text instructions, fallback to `CLAUDE.md` for Claude and `AGENTS.md` otherwise.

## Phase 2: Managed Artifact Canonicalization and Parity

- [x] Treat `.cursor/rules/agentlint-maintenance.mdc` as a generated managed artifact.
- [x] Treat `.windsurf/rules/agentlint-maintenance.md` as a generated managed artifact.
- [x] Treat `.github/copilot-instructions.md` maintenance section as a generated managed artifact.
- [x] Add parity coverage so generator output and checked-in managed artifacts cannot silently diverge.
- [x] Expand CLI writer tests for idempotency, backup creation, line-ending preservation, and Claude-vs-AGENTS fallback.
- [x] Document which files are generated from the canonical snippet model and which remain hand-maintained.

## Phase 3: Discovery and Validator Hardening

- [x] Tighten workspace discovery toward canonical-path-first behavior.
- [x] Reduce false positives from reports, fixtures, examples, and unrelated docs.
- [x] Improve completeness checks from raw substring matching toward heading/frontmatter-aware validation.
- [x] Add allowed heading aliases where naming differs but intent is equivalent.
- [x] Keep package and client overlays discoverable without letting fallback matches outrank canonical files.

## Phase 4: Trigger and Guidance Policy Refinement

- [x] Refine `agentlint_quick_check` signals for structural changes, config changes, dependency changes, CI changes, and security changes.
- [x] Reduce over-triggering on loosely related natural-language requests.
- [x] Make Agent Lint guidance the default truth source unless the user explicitly overrides it.
- [x] Ensure maintenance results tell the user when an update was proposed or applied because of Agent Lint guidance.
- [x] Keep `agentlint_plan_workspace_autofix`, `agentlint_quick_check`, and `agentlint_get_guidelines` in a stable, documented order.

## Phase 5: MCP, Prompt, and CLI Wording Alignment

- [x] Align `packages/mcp/src/server.ts` instructions with the bounded auto-apply contract.
- [x] Align `packages/cli/src/commands/prompt.tsx` with the same workflow ordering and wording.
- [x] Align any plan-builder or maintenance markdown output that still uses conflicting imperative language.
- [x] Keep `agent-lint init` optional for maintenance-rule installation while making the recommendation clearer.

## Phase 6: Minimal Docs and Test Surface Sync

- [x] Update root `README.md` only where behavior actually changed.
- [x] Update `packages/cli/README.md` only where client or maintenance behavior actually changed.
- [x] Update `packages/mcp/README.md` only where tool behavior or instructions changed.
- [x] Update docs-consistency and related tests together with any public-surface wording changes.

## Phase 7: Verification, Scan, and Acceptance

- [x] Run targeted tests for `packages/core/tests/maintenance-snippet.test.ts`.
- [x] Run targeted tests for discovery and quick-check behavior.
- [x] Run targeted CLI maintenance writer and docs-consistency tests.
- [x] Run relevant MCP tools/docs tests if wording or behavior changed there.
- [x] Run `agentlint_plan_workspace_autofix` after context-artifact edits and reconcile findings.
- [x] Confirm no touched canonical artifact is left with missing required sections.

# Verification Commands and Acceptance Criteria

- `pnpm run typecheck`
- `pnpm run test`
- `pnpm exec vitest run packages/core/tests/maintenance-snippet.test.ts packages/core/tests/workspace-discovery.test.ts packages/core/tests/quick-check.test.ts`
- `pnpm exec vitest run packages/cli/tests/maintenance-writer.test.ts packages/cli/tests/docs-consistency.test.ts packages/cli/tests/clients.test.ts`
- `pnpm exec vitest run packages/mcp/tests/tools.test.ts packages/mcp/tests/docs-consistency.test.ts`
- `pnpm run build`
- `pnpm run release-status`
- `agentlint_plan_workspace_autofix`
- Acceptance criteria:
- Root `AGENTS.md` remains the baseline truth source.
- Claude-family fallback resolves to `CLAUDE.md`; all other generic fallback cases resolve to `AGENTS.md`.
- Managed maintenance artifacts are parity-protected.
- Trigger and discovery behavior are stricter, with fewer false positives and less drift.
- Auto-apply language stays strong only inside context artifacts.

# Delivery Evidence

- Files changed: generator, managed rule/instruction artifacts, related CLI/MCP/core tests, and only the docs that reflect actual behavior changes.
- Evidence captured: targeted test output, workspace-scan result, fallback-behavior checks, and parity coverage for managed artifacts.
- Current checkpoint evidence: `agentlint_plan_workspace_autofix` reports 11 discovered artifacts, 0 missing artifact types, and `OK` status for the three new plan files.
- Phase 1/2 checkpoint evidence: `pnpm.cmd exec vitest run packages/core/tests/maintenance-snippet.test.ts packages/cli/tests/maintenance-writer.test.ts` passed with 15/15 tests after the canonical snippet and fallback changes.
- Phase 3 checkpoint evidence: `pnpm.cmd exec vitest run packages/core/tests/workspace-discovery.test.ts packages/core/tests/plan-builder.test.ts` passed with 11/11 tests after heading-aware validation and alias support were added.
- Phase 4 checkpoint evidence: `pnpm.cmd exec vitest run packages/core/tests/quick-check.test.ts packages/mcp/tests/tools.test.ts` passed with 21/21 tests after the quick-check signal model was tightened.
- Phase 5/6 checkpoint evidence: `pnpm.cmd exec vitest run packages/core/tests/plan-builder.test.ts packages/cli/tests/embedded-command-flow.test.ts packages/cli/tests/cli-stdout.test.ts packages/mcp/tests/tools.test.ts` passed after wording and README alignment.
- Final verification evidence: `pnpm.cmd run test`, `pnpm.cmd run typecheck`, `pnpm.cmd run build`, and `pnpm.cmd run lint` passed. `pnpm.cmd run release-status` passed once the new changeset file was temporarily staged for verification, then it was unstaged again to avoid changing the user’s index unexpectedly.
- Final review notes: all planned phases are complete, all tracked verification checks passed, and no follow-up phase is intentionally deferred inside this implementation plan.
