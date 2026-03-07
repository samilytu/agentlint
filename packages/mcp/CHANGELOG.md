# @agent-lint/mcp Changelog

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
