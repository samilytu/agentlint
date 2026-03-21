# Plan: Integrate Claude Code Workflow Guidelines

## Scope and Goals

Integrate Boris Cherny's Claude Code workflow patterns (Plan Mode Default, Subagent Strategy, Self-Improvement Loop, Verification Before Done, Demand Elegance, Autonomous Bug Fixing) into agentlint's recommendation output for `agents`, `workflows`, and `plans` artifact types. Add the source to README Resources.

## Non-goals

- No changes to scoring dimensions or specs.ts mandatory sections
- No changes to skills or rules artifact types
- No changes to maintenance-snippet.ts or CLAUDE.md/AGENTS.md of this repo
- Not a full replacement of existing guidance — additive only

## Phases

### Phase 1: README Resource Reference
- [ ] Add Boris Cherny's Claude Code workflow patterns to `README.md` → "Selected field notes and implementation reports" section
- Format: `- [Title](URL) - short description.`
- Source: Boris Cherny (creator of Claude Code) shared workflow patterns for production Claude usage

### Phase 2: Guidelines Builder — New Workflow Discipline Section
- [ ] Add `buildWorkflowDisciplineGuidance()` function in `guidelines-builder.ts`
- Content distilled from all 6 Cherny patterns, adapted to agentlint's concise/operational style:
  1. **Plan-first default**: Enter plan mode for non-trivial tasks (3+ steps). Re-plan when blocked.
  2. **Subagent strategy**: Offload research/exploration to subagents. One task per subagent. Keep main context clean.
  3. **Self-improvement loop**: Track corrections in a lessons file. Write rules to prevent repeated mistakes.
  4. **Verification before done**: Prove correctness before marking complete. Run tests, check logs, diff behavior.
  5. **Demand elegance (balanced)**: For non-trivial changes, pause and consider if a more elegant solution exists. Skip for simple fixes.
  6. **Autonomous problem solving**: Fix bugs end-to-end without hand-holding. Resolve failing CI autonomously.
- [ ] Include this section in `buildGuidelines()` output when `type` is `agents`, `workflows`, or `plans`
- Place it after the quality checklist and before the file discovery section

### Phase 3: Prompt Pack — Enhance Agents/Workflows/Plans Prompts
- [ ] In `prompt-pack.ts`, add workflow discipline bullets to the `agents` prompt pack under a new "Workflow discipline guidance" heading
- [ ] Add relevant workflow discipline bullets to the `workflows` prompt pack (plan-first, verification, autonomous execution)
- [ ] Add relevant workflow discipline bullets to the `plans` prompt pack (plan-first, re-plan when blocked, verification gates)
- Keep additions concise (3-5 bullets per type, not full copy of all 6 patterns)

### Phase 4: Build and Test
- [ ] Run `pnpm run build` to verify TypeScript compiles
- [ ] Run `pnpm run typecheck` to confirm no type errors
- [ ] Run `pnpm run test` to confirm no regressions
- [ ] Run `pnpm run lint` to confirm style compliance

## Verification

- `pnpm run build && pnpm run typecheck && pnpm run test && pnpm run lint` passes
- `buildGuidelines("agents")` output includes new workflow discipline section
- `buildGuidelines("skills")` output does NOT include workflow discipline section
- `getPromptPack("agents").prompt` includes workflow discipline bullets
- README Resources section has new field note entry

## Risks

- Low risk: additive changes only, no breaking changes to types or interfaces
- Guidelines output grows slightly in token count — mitigate by keeping new section concise (~15-20 lines)
