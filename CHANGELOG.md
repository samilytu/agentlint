# Changelog

This changelog tracks workspace-level changes. Package-specific release notes live in:

- [packages/cli/CHANGELOG.md](packages/cli/CHANGELOG.md)
- [packages/mcp/CHANGELOG.md](packages/mcp/CHANGELOG.md)

## 2026-03-07

### Changed

- Rebuilt the public documentation around the current product surface: 3 CLI commands, 4 MCP tools, and 3 MCP resources.
- Standardized the release model around independent package versions and package-scoped tags: `cli-vX.Y.Z` and `mcp-vX.Y.Z`.
- Set GitHub as the public-facing home for discovery while keeping GitLab CI as the authoritative publish path.
- Prepared the next package versions: `@agent-lint/cli@0.4.2` and `@agent-lint/mcp@0.3.2`.
- Updated the public tagline to "structured, current, and codebase-aware" across repo and package docs.
- Removed internal planning and scratch docs from the tracked public repository surface.

### Fixed

- Stabilized the interactive `agent-lint init` flow for bare invocation, TTY navigation, and embedded result confirmation.
- Aligned MCP timeout configuration with the current public tool names and kept legacy timeout aliases only for compatibility.
- Made MCP server version reporting resolve to the real package version in source, build, HTTP, and stdio flows.
