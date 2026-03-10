---
name: frontend-design
description: Use when the task asks for a UI, Ink screen, docs visual, or front-end polish in this repo. Handles React, Ink, HTML/CSS, and screenshot or demo work that should look intentional instead of generic.
disable-model-invocation: false
---

# When to Use

- Requests for new or revised UI in `packages/cli/src/ui` or `packages/cli/src/commands/*.tsx`.
- Requests for docs visuals or demo assets under `docs/screenshots/`.
- Requests for production-grade front-end or TUI styling that needs a clear visual direction.
- Do not invoke for MCP transport, security, release automation, or backend-only refactors.

# Repository Evidence

- The product UI in this repo is the Ink and React CLI under `packages/cli/src`.
- Visual docs assets live under `docs/screenshots/`.
- CLI verification flows and interaction expectations live in `packages/cli/tests`.

# Clarification Gate

- Inspect the touched UI files first.
- Ask only if the target surface, accessibility requirement, or asset format is still ambiguous after scanning the repo.
- If the repo already establishes a pattern, follow it instead of asking.

# Purpose

- Deliver working UI code or visual assets with a deliberate aesthetic direction, not generic defaults.

# Scope

Included:

- Ink components, command screens, themes, prompts, and status layouts.
- Small docs visuals or demo assets tied to the CLI.
- Typography, color, layout, animation, and interaction choices that fit the request.

Excluded:

- MCP server tools, transport security, release automation, or package publish flow changes.
- Large asset pipelines or brand systems that do not already exist in the repo.

# Inputs

- User goal and target files.
- Existing UI patterns in `packages/cli/src/ui`.
- Technical constraints such as TTY behavior, width, color support, or export format.
- Any screenshots or reference text the user supplied.

# Step-by-Step Execution

1. Inspect the target files, surrounding command flow, and related tests before designing anything.
2. Pick one visual direction that fits the task and the existing CLI tone; state it briefly in your work log if the change is non-trivial.
3. Implement the smallest set of structural and styling changes that fully express the direction.
4. Keep behavior accessible in terminal contexts: readable contrast, sensible wrapping, and graceful fallback when color or width is limited.
5. If docs visuals are part of the task, update or generate them only after the code path is stable.
6. Run the CLI-focused verification commands and inspect the affected screen or asset output.

# Output Contract

- Working code or assets only; no design essay.
- Short summary of changed files, verification run, and any intentional visual tradeoffs.
- If the task needs manual visual review, say exactly what to inspect.

# Verification Commands

- `pnpm run typecheck:cli`
- `pnpm exec vitest run packages/cli/tests`
- `pnpm run cli`
- Re-generate demo assets only when the request touches docs visuals.

# Evidence Format

- List touched UI files.
- List verification commands that passed.
- Note the chosen visual direction in one sentence when it materially affects the outcome.

# Safety Notes and Explicit DONTs

- Do not add new UI dependencies unless the user asked or the repo already uses them.
- Do not break non-interactive stdout flows while polishing TUI screens.
- Do not overwrite `docs/screenshots/*` unless the task explicitly calls for updated visuals.
- Do not use placeholder copy, fake metrics, or inaccessible low-contrast styling.
