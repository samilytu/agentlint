---
"@agent-lint/cli": major
---

Rename `doctor` command to `scan`.

**BREAKING CHANGE:** `agent-lint doctor` is now `agent-lint scan`. All flags (`--stdout`, `--json`, `--save-report`) work the same way. The command scans the workspace for missing, incomplete, stale, conflicting, and weak context artifacts and generates a maintenance report.

If you have scripts or CI pipelines referencing `agent-lint doctor`, update them to `agent-lint scan`.
