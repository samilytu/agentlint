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
| `agent-lint scan` | Scan the workspace and generate a context maintenance report grouped into missing types, incomplete files, stale, conflicting, and weak findings |
| `agent-lint prompt` | Print a ready-to-paste IDE prompt for the next maintenance step, using broad-scan or targeted-maintenance wording plus local change signals when available |
| `agent-lint score <file>` | Score a context artifact against 12 quality dimensions and print targeted improvement suggestions; auto-detects artifact type or accepts `--type` |

### Common command examples

```bash
agent-lint init
agent-lint init --with-rules
agent-lint scan
agent-lint scan --stdout
agent-lint scan --json
agent-lint prompt
agent-lint prompt --stdout
agent-lint score AGENTS.md
agent-lint score CLAUDE.md --type agents
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
| Codex | TOML | Workspace / Global | Uses `.codex/config.toml` or `~/.codex/config.toml`; Agent Lint preserves project-local installs when workspace scope is selected |
| Cursor | JSON | Workspace / Global | Writes `.cursor/mcp.json` or `~/.cursor/mcp.json` |
| OpenCode | JSON | Workspace / Global | Uses `opencode.json` or the OpenCode user config |
| Windsurf | JSON | Workspace / Global | Writes `.windsurf/mcp_config.json` or the Windsurf user config |
| Claude Desktop | JSON | Global | Uses `claude_desktop_config.json` |
| VS Code | JSON | Workspace / Global | Uses VS Code MCP `servers` format |
| Kilo Code | JSON | Workspace / Global | Uses `.kilocode/mcp.json` or the Kilo Code VS Code global storage MCP settings file |
| Cline | JSON | Global | Uses `cline_mcp_settings.json` |
| Roo Code | JSON | Workspace / Global | Uses `.roo/mcp.json` or the Roo Code VS Code global storage MCP settings file |
| Kiro | JSON | Workspace / Global | Uses `.kiro/settings/mcp.json` or `~/.kiro/settings/mcp.json` |
| Zed | JSON | Workspace / Global | Uses `.zed/settings.json` or global Zed settings (`%LOCALAPPDATA%` on Win) |
| Antigravity | JSON | Global | Uses Antigravity MCP config |

## What `scan` Produces

`agent-lint scan` scans for:

- `AGENTS.md` and `CLAUDE.md`
- rules
- skills
- workflows
- plans

It groups what it finds into:

- missing artifact types
- incomplete files with empty or missing required sections
- stale references and canonical-path drift
- conflicting tool-specific guidance
- weak-but-present sections such as placeholders or thin verification guidance

It can save a report file and can also print to stdout or JSON for automation.

## What `score` Produces

`agent-lint score <file>` evaluates a single context artifact against 12 quality dimensions using pure static analysis:

- scope, structure, actionability, verification, security, maintenance, progressive disclosure, cross-references, and more
- each dimension receives a per-signal score with targeted improvement suggestions
- artifact type is auto-detected from the filename or overridden with `--type agents|skills|rules|workflows|plans`
- useful in autoresearch loops: score, improve, compare, keep or revert

## What `prompt` Produces

`agent-lint prompt` reads the current workspace scan and chooses between two handoff styles:

- broad scan when artifacts are missing or grouped findings suggest a full pass
- targeted maintenance when canonical artifacts already look healthy and a narrower follow-up is enough
- local git change signals are included when available so the handoff can reflect recent file changes

## Related

- [Root README](https://github.com/samilozturk/agentlint)
- [MCP package](https://www.npmjs.com/package/@agent-lint/mcp)
- [Authoritative publish source](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
