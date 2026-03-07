# @agent-lint/cli

CLI for keeping `AGENTS.md`, rules, and skills structured, current, and codebase-aware.

Use it to set up Agent Lint, scan a workspace, and print ready-to-paste prompts for your coding agent.

## Install and Run

```bash
npx @agent-lint/cli init
```

The `agent-lint` binary opens an interactive TUI in a TTY and falls back to help output in non-interactive environments.

## Commands

| Command | Purpose |
| --- | --- |
| `agent-lint init` | Detect supported IDE clients and install an Agent Lint MCP entry |
| `agent-lint doctor` | Scan the workspace and generate a context maintenance report |
| `agent-lint prompt` | Print a ready-to-paste IDE prompt for the next maintenance step |

### Common command examples

```bash
agent-lint init
agent-lint doctor
agent-lint doctor --stdout
agent-lint doctor --json
agent-lint prompt
agent-lint prompt --stdout
```

## Supported IDEs

| IDE | Format | Scopes | Notes |
| --- | --- | --- | --- |
| Cursor | JSON | Workspace / Global | Writes `.cursor/mcp.json` or `~/.cursor/mcp.json` |
| Windsurf | JSON | Workspace / Global | Writes `.windsurf/mcp_config.json` or the Windsurf user config |
| VS Code | JSON | Workspace / Global | Uses VS Code MCP `servers` format |
| Claude Desktop | JSON | Global | Uses `claude_desktop_config.json` |
| Claude Code | JSON | Workspace / Global | Uses `.mcp.json` or `~/.claude/.mcp.json` |
| Codex CLI | TOML | Workspace / Global | Uses `.codex/config.toml` or `~/.codex/config.toml` |
| OpenCode | JSON | Workspace / Global | Uses `opencode.json` or the OpenCode user config |
| Cline | JSON | Global | Uses the Cline global MCP settings file |
| Kiro | JSON | Global | Uses the Kiro global MCP settings file |
| Zed | JSON | Workspace / Global | Uses Zed context server settings |

## What `doctor` Produces

`agent-lint doctor` scans for:

- `AGENTS.md` and `CLAUDE.md`
- rules
- skills
- workflows
- plans

It writes a report file by default and can also print to stdout or JSON for automation.

## Related

- [Root README](https://github.com/samilytu/agentlint)
- [MCP package](https://www.npmjs.com/package/@agent-lint/mcp)
- [Authoritative publish source](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
