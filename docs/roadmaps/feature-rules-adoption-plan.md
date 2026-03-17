# Feature And Rule Adoption Plan

## Scope and Goals

- Add low-risk, deterministic heuristics that improve context-artifact maintenance without changing Agent Lint's product identity.
- Strengthen `packages/core/src/workspace-discovery.ts`, `packages/core/src/quick-check.ts`, `packages/cli/src/commands/doctor.tsx`, and `packages/cli/src/commands/prompt.tsx` before considering any new public surface.
- Keep the monorepo boundary intact: `shared <- core <- mcp` and `shared <- core <- cli`.
- Keep the MCP server read-only and stateless.
- Update docs and tests together whenever user-visible behavior changes.
- Use `agentlint-example/` only as an inspiration source for rule ergonomics, category naming, reporting flow, and tool-specific hygiene ideas. Do not treat it as implementation truth.

## Non-Goals

- Do not turn Agent Lint into a VS Code extension product.
- Do not import the entire `agentlint-example/` 67-rule surface as-is.
- Do not add telemetry, analytics, hosted services, persistent state, or readiness scoring.
- Do not add MCP-side file writing, patch application, or silent auto-remediation.
- Do not expand the public CLI/MCP surface unless an existing command or resource cannot carry the new behavior safely.

## Current-State Assumptions

- Discovery and required-section checking already exist in `packages/core/src/workspace-discovery.ts`.
- Structural trigger detection already exists in `packages/core/src/quick-check.ts`.
- The current CLI surface remains `init`, `doctor`, and `prompt`.
- Public docs are protected by docs-consistency tests in `packages/cli/tests/docs-consistency.test.ts` and `packages/mcp/tests/docs-consistency.test.ts`.
- Root scripts in `package.json`, `CONTRIBUTING.md`, and `PUBLISH.md` remain the source of truth for verification commands.
- `agentlint-example/` is a separate project and must be consulted only for inspiration:
  - `agentlint-example/src/rules/categories/structure.ts`
  - `agentlint-example/src/rules/categories/prompt.ts`
  - `agentlint-example/src/rules/categories/cursor.ts`
  - `agentlint-example/src/rules/categories/copilot.ts`
  - `agentlint-example/src/rules/categories/memory.ts`
  - `agentlint-example/src/rules/categories/mcp.ts`

## Risks and Dependencies

- Heuristic drift: new checks may create false positives if they are based on loose keyword matching instead of artifact context.
- Product drift: too many rule ideas can turn Agent Lint into a generic linter rather than a maintenance engine.
- Docs drift: CLI or doctor wording changes can desynchronize README and package README content.
- Boundary drift: CLI convenience work can accidentally push logic out of `core`.
- This work depends on:
  - `packages/shared` contracts and artifact type modeling
  - `packages/core` discovery and quick-check behavior
  - `packages/cli` report and prompt rendering
  - existing docs-consistency tests
  - the current read-only MCP guarantees

## Phase 0: Rule Inventory And Planning Baseline

### Goal

- Lock the rule inventory and implementation boundaries before changing code.

### Checklist

- [ ] Upgrade this roadmap to the same quality bar as the planning artifacts under `docs/plans/`.
- [ ] Create a rule adoption matrix with these columns:
  - rule name
  - source inspiration
  - deterministic or not
  - repo-evidence-based or not
  - false-positive risk
  - target package
  - public-surface impact
- [ ] Explicitly classify `agentlint-example/` rule categories into:
  - inspiration only
  - low-risk to adapt
  - do not adopt
- [ ] Document a permanent "never add" list inside the roadmap:
  - telemetry
  - readiness score
  - hosted or stateful layer
  - MCP-side writing
  - broad heuristic linter platform behavior

### Accepted Low-Risk Inspiration Set

- Structure:
  - `FILE_TOO_LONG`
  - `MISSING_COMMANDS`
  - `DISCOVERABLE_INFO`
- Prompt hygiene:
  - `AMBIGUOUS_INSTRUCTION`
  - `REDUNDANT_GENERIC_INSTRUCTION`
  - `RULES_FILE_MISSING_GLOB`
- Tool-specific hygiene:
  - `CURSOR_MDC_MISSING_FRONTMATTER`
  - `CURSOR_CONFLICTING_WITH_CLAUDE`
  - `COPILOT_WRONG_LOCATION`
  - `COPILOT_CLAUDE_SPECIFIC_INSTRUCTIONS`
- Local-memory hygiene:
  - `MEMORY_LOCAL_NOT_GITIGNORED`
  - `MEMORY_OVERRIDES_MAIN`

### Tests and Controls

- [ ] Verify this plan artifact still contains:
  - scope and goals
  - non-goals
  - current-state assumptions
  - risks and dependencies
  - phases with checklists
  - verification commands and acceptance criteria
  - delivery evidence
- [ ] Verify all commands referenced in this file match root scripts and docs.
- [ ] Confirm `agentlint-example/` references are file-specific and never generic.

### Definition of Done

- [ ] Every candidate rule or feature has a target phase and target package.
- [ ] `agentlint-example/` is referenced as inspiration with concrete file paths.
- [ ] The "do not adopt" list is explicit and stable.

## Phase 1: Deterministic Core Heuristics

### Goal

- Extend `core` with low-risk findings that fit naturally into discovery and quick-check behavior.

### Implementation Checklist

- [ ] Add reusable detection helpers in `shared` or `core` for:
  - placeholder text detection
  - stale path reference detection
  - empty or weak section detection
  - cross-tool leakage detection
- [ ] Expand workspace discovery output beyond `missingSections` with:
  - `staleReferences`
  - `placeholderSections`
  - `crossToolLeaks`
  - `canonicalPathDrift`
- [ ] Extend `quick_check` signals for:
  - tool-specific artifact changes
  - managed-rule and root-artifact overlap
  - stronger maintenance actions for public maintenance-surface files
- [ ] Keep all new findings explainable with one clear remediation sentence.
- [ ] Keep the MCP contract unchanged.

### Phase 1 Rule Backlog

- [ ] Stale path references in context artifacts.
- [ ] Placeholder or empty required sections.
- [ ] Weak verification guidance in artifacts that should contain commands.
- [ ] Cross-tool leakage in tool-specific files.
- [ ] Local-only file hygiene reminders.
- [ ] Canonical-path drift when fallback paths are used without canonical artifacts.

### `agentlint-example/` Inspiration Notes

- [ ] Review `DISCOVERABLE_INFO` in `agentlint-example/src/rules/categories/structure.ts` and adapt only the "document what the repo cannot infer" principle.
- [ ] Review `AMBIGUOUS_INSTRUCTION` and `REDUNDANT_GENERIC_INSTRUCTION` in `agentlint-example/src/rules/categories/prompt.ts`, but implement them as section-quality heuristics rather than a broad semantic linter.
- [ ] Review `CURSOR_*` and `COPILOT_*` rules only to improve current client-specific hygiene. Do not create a full category registry.

### Tests and Controls

- [ ] Extend `packages/core/tests/workspace-discovery.test.ts` with fixtures for:
  - stale references
  - placeholder sections
  - wrong-tool references in managed files
  - fallback-path artifacts with missing canonical artifacts
- [ ] Extend `packages/core/tests/quick-check.test.ts` with scenarios for:
  - `.cursor/rules/` changes
  - `.github/copilot-instructions.md` changes
  - maintenance-surface source file changes
- [ ] Add negative tests to prove:
  - runnable commands are not flagged as placeholders
  - README content is not treated as a context artifact
  - plain keyword matches do not trigger findings without context

### Acceptance Criteria

- [ ] Every new heuristic is fully local and repo-evidence-based.
- [ ] No heuristic requires network access, semantic scoring, or hidden runtime state.
- [ ] `doctor` can consume richer findings without any new command being added.
- [ ] At least six new deterministic findings are covered by tests.

### Definition of Done

- [ ] `core` can surface richer maintenance findings with low false-positive risk.
- [ ] All Phase 1 heuristics are protected by targeted tests.
- [ ] Any user-visible wording change is documented and test-aligned.

## Phase 2: Operational Doctor And Prompt Output

### Goal

- Turn the richer `core` findings into a clearer, more actionable user workflow.

### Implementation Checklist

- [ ] Update `doctor` output to group findings into:
  - missing
  - stale
  - conflicting
  - weak-but-present
- [ ] Add remediation ordering to `doctor` output:
  - security or hygiene first
  - drift second
  - quality improvements third
- [ ] Make `prompt` context-aware using discovery and quick-check results:
  - what artifact types need attention
  - whether the user likely needs a broad scan or a targeted maintenance pass
  - which managed or client-specific files are active
- [ ] If filtering is added, keep it optional and additive. Do not replace the default workflow.

### Phase 2 Feature Backlog

- [ ] Severity-grouped `doctor` output.
- [ ] Context-aware `prompt` handoff.
- [ ] Optional `doctor` filtering by artifact type.
- [ ] Stronger next-step messaging tied to actual findings.

### `agentlint-example/` Inspiration Notes

- [ ] Review reporting flow in `agentlint-example/src/readiness/core.ts` for roadmap-style grouping ideas.
- [ ] Do not adopt:
  - numeric scores
  - grades
  - cost calculations
  - telemetry-backed usage loops

### Tests and Controls

- [ ] Update CLI flow tests covering grouped `doctor` output.
- [ ] Extend `packages/cli/tests/next-action.test.ts` for remediation ordering.
- [ ] Extend `packages/cli/tests/interactive-mode.test.ts` if filtering is introduced.
- [ ] Update `packages/cli/tests/docs-consistency.test.ts` if README wording changes.
- [ ] Prefer behavior assertions over fragile snapshots.

### Acceptance Criteria

- [ ] `prompt` no longer returns the same fixed handoff text in all cases.
- [ ] `doctor` output makes ordering and maintenance priority clear.
- [ ] No new command is added unless the existing surface cannot safely hold the behavior.
- [ ] Root README and package README text remain aligned with the actual user flow.

### Definition of Done

- [ ] A user can run `doctor` and understand what to fix first.
- [ ] A user can run `prompt` and get a handoff that reflects current workspace state.
- [ ] All user-facing text changes are docs-consistency protected.

## Phase 3: Controlled Operational Expansion

### Goal

- Add optional high-leverage features only after core heuristics and CLI flow are stable.

### Implementation Checklist

- [ ] Design a lightweight context export that shows:
  - canonical artifacts
  - managed client files
  - missing vs present vs drifted state
- [ ] Evaluate whether extra MCP resources are warranted for:
  - anti-pattern catalogs
  - example snippets
  - client matrices
- [ ] If a migration helper is added, scope it to narrow, explicit starting states.
- [ ] If a compact status summary is added, keep it descriptive and operational, never score-based.

### Phase 3 Feature Backlog

- [ ] Lightweight context export.
- [ ] Optional new MCP resources only if discoverability clearly improves.
- [ ] Migration helpers for minimal setup shapes.
- [ ] Compact operational summary with no scoring.

### `agentlint-example/` Inspiration Notes

- [ ] Review `agentlint-example/src/contextExport.ts` for export ergonomics only.
- [ ] Do not adopt:
  - `score`
  - `maturity`
  - `toolFit`
  - `cost`
  - `analytics`

### Tests and Controls

- [ ] If new MCP resources are added, update:
  - `packages/mcp/tests/docs-consistency.test.ts`
  - relevant MCP resource registration tests
- [ ] If export output is added, cover ordering, filtering, and no-regression behavior in CLI tests.
- [ ] Only add new MCP tool tests if a new tool is absolutely necessary.

### Acceptance Criteria

- [ ] Any new feature adds visibility without expanding the product into a new category.
- [ ] Export or summary output stays guidance-oriented, not metric-oriented.
- [ ] Docs and tests stay proportional to the size of the new surface.

### Definition of Done

- [ ] Users can inspect workspace context state more easily.
- [ ] Agent Lint still reads as a guidance-first maintenance engine.
- [ ] Public surface remains small, testable, and documented.

## Verification Commands and Acceptance Criteria

### Baseline Commands

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run lint`

### When Public Surface Changes

- `pnpm run release-status`
- `cd packages/cli && npm pack --dry-run`
- `cd ../mcp && npm pack --dry-run`

### Phase Controls

- [ ] Every new heuristic has a remediation sentence.
- [ ] No finding duplicates README prose or drifts into general coding advice.
- [ ] Tool-specific checks target the correct artifact types.
- [ ] Docs-consistency tests are updated when user-visible wording changes.
- [ ] `agentlint-example/` is still being used as inspiration, not as a source-of-truth template.

### False-Positive Controls

- [ ] Simple keyword matching alone is not enough to trigger a finding.
- [ ] Section, heading, frontmatter, or artifact-type context must be present where relevant.
- [ ] Tool-specific leakage checks only fire in the wrong artifact context.
- [ ] Placeholder detection must not flag:
  - runnable commands
  - fenced code blocks
  - valid templates or examples

## Delivery Evidence

- [ ] Updated roadmap with phase-owned behavior, tests, and controls.
- [ ] Rule adoption matrix and "never add" list embedded in planning artifacts or PR notes.
- [ ] Targeted tests added for each adopted heuristic or reporting behavior.
- [ ] README and package README changes included only when behavior changed.
- [ ] Completion evidence recorded in PR or implementation notes:
  - touched files
  - tests run
  - deferred items
  - any `agentlint-example/` inspirations consulted

## Global Definition of Done

- [ ] The implementation can be executed phase by phase without leaving design decisions to the implementer.
- [ ] Each phase specifies:
  - goal
  - checklist
  - inspiration boundaries
  - tests and controls
  - acceptance criteria
  - definition of done
- [ ] The final product is more useful without becoming noisier, broader, or less reliable.
