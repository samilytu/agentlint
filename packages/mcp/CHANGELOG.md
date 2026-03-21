# @agent-lint/mcp Changelog

## 0.6.0

### Minor Changes

- 4d64e2a: Add workflow discipline guidance to agents, workflows, and plans artifact types.

  New `buildWorkflowDisciplineGuidance()` section in guidelines output covers plan-first default, subagent strategy, self-improvement loops, verification gates, demand elegance, and autonomous problem solving — inspired by Boris Cherny's Claude Code team workflow patterns.

  Prompt packs for agents, workflows, and plans now include workflow discipline bullets. README resources updated with the source reference.

## 0.5.0

### Minor Changes

- 66d9f00: Add `score` command, `agentlint_score_artifact` MCP tool, and 9-category skill linting taxonomy.

  **`agent-lint score <file>`** scores any context artifact against 12 quality dimensions using pure static analysis. Artifact type is auto-detected from the filename or set with `--type agents|skills|rules|workflows|plans`. Prints a per-dimension score with targeted improvement suggestions. Useful in autoresearch loops: score, improve, compare, keep or revert.

  **`agentlint_score_artifact`** is the MCP-native equivalent, accepting artifact content and type directly. Runs with a 30-second timeout and is read-only.

  **Skill linting** now uses a 9-category taxonomy with Claude Code best practices, delivering richer and more targeted improvement suggestions across all skill quality dimensions.

## 0.4.1

### Patch Changes

- a846ee6: Align maintenance guidance, fallback behavior, and context-artifact verification across the CLI and MCP packages.

  This update makes the maintenance snippet canonical, tightens discovery and quick-check behavior, and keeps client-specific instruction files in sync with the generated maintenance contract.

## 0.4.0

### Minor Changes

- 637e0e2: Add maintenance rule installation to `agent-lint init`, make repeated installs update managed rule files cleanly, and expand maintenance snippets so agents can infer Agent Lint tasks from plain-English context requests.

## 0.3.4

### Patch Changes

- a4047fa: Fix doctor workspace discovery and report persistence regressions, and align cross-platform fixture coverage for CLI and MCP outputs.

## [0.3.3]

### Fixed

- GitLab publish jobs now support both plain and file-based `NPM_TOKEN` variables and fail fast on invalid npm auth

## [0.3.2]

### Changed

- README and npm description now use the current public positioning around structured, current, codebase-aware agent context
- Public repository cleanup removed internal planning docs from the published surface

## [0.3.1]

### Changed

- README, npm metadata, and release metadata now match the current 4-tool MCP surface

### Fixed

- Tool timeout wiring is now attached to the active public tools
- Server version resolution now prefers the package version instead of unrelated workspace env values

## [0.3.0]

### Added

- Read-only MCP server with 4 tools and 3 resources
- Stdio and HTTP transports
- Programmatic server creation helpers

### Fixed

- Current tool timeout wiring now matches the public tool surface
- Server version reporting now resolves to the real package version
