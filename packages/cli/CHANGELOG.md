# @agent-lint/cli Changelog

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
