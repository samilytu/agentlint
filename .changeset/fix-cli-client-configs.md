---
"@agent-lint/cli": patch
---

Fix MCP client config installation edge cases across supported editors.

- preserve project-local Codex installs by keeping `.codex/config.toml` as the workspace target
- update Kilo Code global installs to use the VS Code global storage MCP settings path
- treat empty existing JSON and TOML config files as mergeable instead of failing setup
