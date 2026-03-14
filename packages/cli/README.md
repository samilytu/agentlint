# @agent-lint/cli

CLI for keeping `AGENTS.md`, `CLAUDE.md`, rules, skills, workflows, and plans structured, current, and codebase-aware.

Use it to set up Agent Lint, scan a workspace, and print ready-to-paste prompts for your coding agent.

## Install and Run

```bash
npx @agent-lint/cli init
```

The `agent-lint` binary opens an interactive TUI in a TTY and falls back to help output in non-interactive environments.

## Commands

| Command | Purpose |
| --- | --- |
| `agent-lint init` | Detect supported IDE clients, install an Agent Lint MCP entry, and optionally add maintenance rules |
| `agent-lint doctor` | Scan the workspace and generate a context maintenance report |
| `agent-lint prompt` | Print a ready-to-paste IDE prompt for the next maintenance step |

### Common command examples

```bash
agent-lint init
agent-lint init --with-rules
agent-lint doctor
agent-lint doctor --stdout
agent-lint doctor --json
agent-lint prompt
agent-lint prompt --stdout
```

Re-running `agent-lint init --with-rules` updates managed rule files in place and avoids duplicate snippets.

## Maintenance Targets

When you install maintenance rules, Agent Lint uses the client-specific instruction surface where possible:

- Cursor -> managed file at `.cursor/rules/agentlint-maintenance.mdc`
- Windsurf -> managed file at `.windsurf/rules/agentlint-maintenance.md`
- VS Code / Copilot -> appends a managed maintenance block to `.github/copilot-instructions.md`
- Claude Desktop / Claude Code -> appends the maintenance block to `CLAUDE.md`
- Other clients -> appends the maintenance block to `AGENTS.md`

## Supported IDEs

| IDE | Format | Scopes | Notes |
| --- | --- | --- | --- |
| Claude Code | JSON | Workspace / Global | Uses `.mcp.json` or `~/.claude.json`; prefers the `claude mcp add` flow when available |
| Codex | TOML | Workspace / Global | Uses `.codex/config.toml` or `~/.codex/config.toml` |
| Cursor | JSON | Workspace / Global | Writes `.cursor/mcp.json` or `~/.cursor/mcp.json` |
| OpenCode | JSON | Workspace / Global | Uses `opencode.json` or the OpenCode user config |
| Windsurf | JSON | Workspace / Global | Writes `.windsurf/mcp_config.json` or the Windsurf user config |
| Claude Desktop | JSON | Global | Uses `claude_desktop_config.json` |
| VS Code | JSON | Workspace / Global | Uses VS Code MCP `servers` format |
| Kilo Code | JSON | Workspace / Global | Uses `.kilocode/mcp.json` or the Kilo VS Code global storage MCP settings file |
| Cline | JSON | Global | Uses the Cline global MCP settings file |
| Roo Code | JSON | Workspace / Global | Uses `.roo/mcp.json` or the Roo Code VS Code global storage MCP settings file |
| Kiro | JSON | Workspace / Global | Uses `.kiro/settings/mcp.json` or `~/.kiro/settings/mcp.json` |
| Zed | JSON | Workspace / Global | Uses Zed context server settings |

## What `doctor` Produces

`agent-lint doctor` scans for:

- `AGENTS.md` and `CLAUDE.md`
- rules
- skills
- workflows
- plans

It can save a report file and can also print to stdout or JSON for automation.

## Related

- [Root README](https://github.com/samilytu/agentlint)
- [MCP package](https://www.npmjs.com/package/@agent-lint/mcp)
- [Authoritative publish source](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
