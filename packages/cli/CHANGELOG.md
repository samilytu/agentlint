# @agent-lint/cli Changelog

## 0.5.1

### Patch Changes

- a846ee6: Align maintenance guidance, fallback behavior, and context-artifact verification across the CLI and MCP packages.

  This update makes the maintenance snippet canonical, tightens discovery and quick-check behavior, and keeps client-specific instruction files in sync with the generated maintenance contract.

## 0.5.0

### Minor Changes

- 637e0e2: Add maintenance rule installation to `agent-lint init`, make repeated installs update managed rule files cleanly, and expand maintenance snippets so agents can infer Agent Lint tasks from plain-English context requests.

## 0.4.5

### Patch Changes

- 5db9d58: Make doctor report persistence opt-in with `--save-report`, simplify prompt flow, and align the TUI next-step behavior with the new CLI flow.

## 0.4.4

### Patch Changes

- a4047fa: Fix doctor workspace discovery and report persistence regressions, and align cross-platform fixture coverage for CLI and MCP outputs.

## [0.4.3]

### Fixed

- GitLab publish jobs now support both plain and file-based `NPM_TOKEN` variables and fail fast on invalid npm auth

## [0.4.2]

### Changed

- README, npm description, and help copy now use the current public positioning around structured, current, codebase-aware agent context
- Public repository cleanup removed internal planning docs from the published surface

## [0.4.1]

### Changed

- README, npm metadata, and release metadata now match the current 3-command CLI surface

### Fixed

- Interactive `init` defaults no longer depend on PATH-only client detection
- Embedded init flow remains stable in TTY tests and waits for explicit confirmation

## [0.4.0]

### Added

- Interactive `agent-lint` TUI for `init`, `doctor`, and `prompt`
- IDE-aware MCP config setup across supported clients
- Workspace report generation and prompt handoff workflow

### Fixed

- Non-TTY bare invocation now falls back to help output
- Embedded init flow keeps results visible until the user confirms
