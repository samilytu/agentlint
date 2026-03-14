# Scope and Goals

- Capture the main failure modes, review gates, and red lines for the context-artifact maintenance rollout.
- Keep the team focused on correctness, drift reduction, and safe client behavior while the implementation plan is executed.
- Provide a compact checklist that can be reviewed before and after each phase.

# Non-Goals

- This file is not the primary implementation plan.
- This file is not a substitute for tests, scans, or code review.
- This file does not broaden Agent Lint authority beyond context artifacts and their tightly-coupled docs/tests.

# Current-State Assumptions

- Root `AGENTS.md` remains the baseline context policy.
- Claude-family fallback resolves to `CLAUDE.md`; all other generic fallback cases resolve to `AGENTS.md`.
- Managed maintenance artifacts exist today for Cursor, Windsurf, and Copilot.
- The current public behavior still flows through the four MCP tools and the three CLI commands.
- User instructions override default Agent Lint guidance only when the user explicitly says otherwise.

# Risks and Dependencies

- Snippet drift can return immediately if generator changes are made without parity checks.
- Discovery hardening can still regress if plan/report/example docs are not covered by tests.
- Trigger wording can create policy fights if strong auto-apply language is allowed to leak outside context artifacts.
- Client-specific changes can silently break fallback behavior if README tables and tests are not updated together.
- These cautions depend on code, tests, and docs being reviewed as one system rather than in isolation.

# Phases with Checklists

## Phase 0 Review Gates

- [x] The chosen architecture is layered, not rules-only.
- [x] Root `AGENTS.md` is explicitly treated as the baseline source of truth.
- [x] Skills are explicitly treated as optional and specialized.
- [x] Package-level AGENTS coverage remains intentionally narrow.

## Phase 1 and 2 Review Gates

- [x] Do not let checked-in managed artifacts become more detailed than the canonical generator.
- [x] Do not keep semantic content in client renderers if it can live in shared canonical data.
- [x] Do not special-case Claude fallback in code without tests.
- [x] Do not special-case non-Claude fallback in code without tests.
- [x] Do not weaken backup, replace, append, or line-ending behavior in the CLI writer.

## Phase 3 and 4 Review Gates

- [x] Do not trust substring-only completeness checks where heading-aware validation is needed.
- [x] Do not let reports, fixtures, examples, or unrelated docs outrank canonical artifact paths.
- [x] Do not let natural-language trigger expansion create constant Agent Lint overreach.
- [x] Do not hide when an update came from default Agent Lint guidance versus an explicit user instruction.

## Phase 5 and 6 Review Gates

- [x] Do not let MCP, CLI, and generated snippet wording diverge again.
- [x] Do not document behavior that tests cannot prove.
- [x] Do not update README prose before the behavior and tests are settled.
- [x] Do not expand auto-apply wording from context artifacts to generic code edits.

## Phase 7 Final Review Gates

- [x] Re-run targeted tests before claiming a phase complete.
- [x] Re-run `agentlint_plan_workspace_autofix` after context-artifact edits.
- [x] Confirm each touched plan file still contains scope, non-goals, risks, phases, verification, and evidence.
- [x] Confirm every deferred task is explicitly documented.

# Verification Commands and Acceptance Criteria

- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm run release-status`
- `pnpm exec vitest run packages/core/tests/maintenance-snippet.test.ts packages/core/tests/workspace-discovery.test.ts packages/core/tests/quick-check.test.ts`
- `pnpm exec vitest run packages/cli/tests/maintenance-writer.test.ts packages/cli/tests/docs-consistency.test.ts packages/cli/tests/clients.test.ts`
- `pnpm exec vitest run packages/mcp/tests/tools.test.ts packages/mcp/tests/docs-consistency.test.ts`
- `agentlint_plan_workspace_autofix`
- Acceptance criteria:
- Fallback behavior is still correct for Claude and non-Claude clients.
- Managed maintenance artifacts are parity-protected.
- Discovery is stricter and lower-noise than before.
- Strong auto-apply wording is still bounded to context artifacts.

# Delivery Evidence

- Evidence should include the final list of touched files, the commands run, and whether scan/tests passed.
- Evidence should explicitly call out any unresolved risks, deferrals, or known follow-up phases.
- Evidence should be easy to compare against the task list and implementation plan so drift is visible.
- Current final evidence set: full test suite passed, root typecheck/build/lint passed, release-status passed with the new changeset file temporarily staged for verification, and the final workspace scan reports all discovered canonical artifacts as `OK`.
