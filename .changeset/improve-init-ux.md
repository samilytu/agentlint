---
"@agent-lint/cli": patch
---

Improve the `init` MCP client setup flow for single-client and stale-config cases.

- let `Enter` select the focused client in the interactive picker while keeping `Space` for multi-select toggles
- simplify detected-client labels and make scope support more visible during setup
- repair stale existing `agentlint` config entries in place instead of skipping them blindly
