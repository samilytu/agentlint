# @agent-lint/cli

CLI for AI agent context artifact orchestration.

**Zero LLM dependencies.** Fully deterministic. Local-first. No database. No auth.

## What It Does

Command-line tool for setting up and maintaining AI-agent context artifacts:

- `AGENTS.md` / `CLAUDE.md`
- Skills, Rules, Workflows, Plans

Auto-detect your IDE, scan your workspace for missing or incomplete artifacts, and get a copy-paste prompt to start improving them.

## Quick Start

```bash
# Auto-detect IDE and create MCP config
npx @agent-lint/cli init

# Scan workspace and generate fix report
npx @agent-lint/cli doctor

# Get a copy-paste prompt for your IDE chat
npx @agent-lint/cli prompt
```

## Commands

### `init`

Interactive TUI wizard that auto-detects your IDE (Cursor, Windsurf, VS Code, Claude, OpenCode, Zed, Codex, Cline, Kiro) and creates the appropriate MCP config file.

```bash
agent-lint init
```

Supports both project-level and global scope installation. Backs up existing configs before merging.

### `doctor`

Scan your workspace for all AI agent artifacts, identify gaps, and generate a fix report.

```bash
agent-lint doctor
agent-lint doctor --stdout    # Print to stdout instead of file
agent-lint doctor --json      # JSON output for programmatic use
```

### `prompt`

Output a copy-paste prompt for your IDE's AI chat. Paste it and your coding agent will use Agent Lint's MCP tools to scan, create, and fix all context artifacts.

```bash
agent-lint prompt
```

## Supported IDEs

| IDE | Config Format | Scope |
| --- | ------------- | ----- |
| Cursor | JSON | Project / Global |
| Windsurf | JSON | Project / Global |
| VS Code | JSON | Project / Global |
| Claude Desktop | JSON | Global |
| Claude Code | CLI | Global |
| OpenCode | JSON | Project |
| Zed | JSON | Project / Global |
| Codex | TOML | Global |
| Cline | JSON | Project / Global |
| Kiro | JSON | Project |

## CI/CD Integration

### GitHub Actions

```yaml
name: Agent Lint
on:
  pull_request:
    paths:
      - "AGENTS.md"
      - "CLAUDE.md"
      - ".cursor/rules/**"
      - ".windsurf/rules/**"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npx -y @agent-lint/cli doctor --json
```

## Supported Artifact Types

| Type | File Patterns |
| ---- | ------------- |
| **Agents** | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| **Rules** | `.cursor/rules/*.md`, `.windsurf/rules/*.md` |
| **Skills** | `.cursor/skills/*/SKILL.md`, `.windsurf/skills/*/SKILL.md` |
| **Workflows** | `.cursor/workflows/*.md`, `.windsurf/workflows/*.md` |
| **Plans** | `docs/*.md`, `.windsurf/plans/*.md` |

## Related

- [`@agent-lint/mcp`](https://www.npmjs.com/package/@agent-lint/mcp) — MCP server for IDE integration
- [Repository](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
