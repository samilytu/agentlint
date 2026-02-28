# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — Unreleased

### Added

- Initial monorepo structure with 4 packages: `@agent-lint/shared`, `@agent-lint/core`, `@agent-lint/mcp`, `@agent-lint/cli`
- 12-metric deterministic quality scoring engine for AI agent context artifacts
- MCP server (stdio transport) with 8 tools: `analyze_artifact`, `analyze_workspace_artifacts`, `analyze_context_bundle`, `prepare_artifact_fix_context`, `submit_client_assessment`, `quality_gate_artifact`, `suggest_patch`, `validate_export`
- CLI with 3 commands: `analyze`, `scan`, `score` — supports `--json`, `--verbose`, `--quiet`, `--fail-below`
- Security hardening: SHA-256 hash guard, extension allowlist, path traversal protection, backup/rollback, tool timeouts, message size limits
- Input sanitization: prompt injection detection, shell injection, path injection, environment variable interpolation
- 247 tests across all packages
- StreamableHTTP transport with CORS, bearer token auth, rate limiting, per-session isolation
- Custom Rule API: user-defined lint rules in `.agentlint/rules/`
- Plugin system: npm-installable rule packages with `agentlint-plugin-*` / `@*/agentlint-plugin-*` conventions
- Watch mode: `--watch` flag on `analyze` and `scan` commands for automatic re-analysis on file changes
- GitHub Actions CI pipeline (test on Node 18/20/22 + lint)
- Tag-triggered npm publish with provenance (sigstore)
- Contributing guide and issue templates
