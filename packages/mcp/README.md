# @agent-lint/mcp

MCP server for AI agent context artifact orchestration.

**Zero LLM dependencies.** Fully deterministic. Local-first. No database. No auth.

## What It Does

Provides a [Model Context Protocol](https://modelcontextprotocol.io/) server that guides your coding agent in creating, maintaining, and improving AI-agent context artifacts:

- `AGENTS.md` / `CLAUDE.md`
- Skills, Rules, Workflows, Plans

Comprehensive guidelines, workspace scanning, maintenance rules, and repeatable improvement loops — all without calling any LLM.

## Quick Start

```bash
npx -y @agent-lint/mcp
```

## MCP Client Configuration

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentlint": {
      "command": "npx",
      "args": ["-y", "@agent-lint/mcp"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentlint": {
      "command": "npx",
      "args": ["-y", "@agent-lint/mcp"]
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "agentlint": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@agent-lint/mcp"]
    }
  }
}
```

### Windsurf

Add to `.windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "agentlint": {
      "command": "npx",
      "args": ["-y", "@agent-lint/mcp"]
    }
  }
}
```

## Available Tools (4)

| Tool | Description |
| ---- | ----------- |
| `agentlint_get_guidelines` | Returns comprehensive guidelines for creating or updating any artifact type — mandatory sections, do/don't lists, anti-patterns, templates, and quality checklist |
| `agentlint_plan_workspace_autofix` | Scans your workspace, discovers all context artifacts, identifies missing files and incomplete sections, and returns a step-by-step fix plan |
| `agentlint_quick_check` | After structural changes (new modules, config changes, dependency updates), checks if context artifacts need updating |
| `agentlint_emit_maintenance_snippet` | Returns a persistent rule snippet for your IDE that keeps your agent maintaining context automatically |

## MCP Resources (3)

| Resource | Content |
| -------- | ------- |
| `agentlint://guidelines/{type}` | Full guidelines for an artifact type |
| `agentlint://template/{type}` | Skeleton template for creating a new artifact |
| `agentlint://path-hints/{type}` | File discovery patterns per IDE client |

## Supported Artifact Types

| Type | File Patterns |
| ---- | ------------- |
| **Agents** | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| **Rules** | `.cursor/rules/*.md`, `.windsurf/rules/*.md` |
| **Skills** | `.cursor/skills/*/SKILL.md`, `.windsurf/skills/*/SKILL.md` |
| **Workflows** | `.cursor/workflows/*.md`, `.windsurf/workflows/*.md` |
| **Plans** | `docs/*.md`, `.windsurf/plans/*.md` |

## Quality Metrics (12)

`clarity` · `specificity` · `scope-control` · `completeness` · `actionability` · `verifiability` · `safety` · `injection-resistance` · `secret-hygiene` · `token-efficiency` · `platform-fit` · `maintainability`

## Programmatic Usage

```typescript
import { createAgentLintMcpServer } from "@agent-lint/mcp";

const server = createAgentLintMcpServer({
  transportMode: "stdio",
});
```

## HTTP Transport

```bash
npx @agent-lint/mcp --http --port 3001
```

## Design Principles

- **No LLM**: Fully deterministic. No API calls, no tokens, no cost.
- **No State**: Every call is stateless. No database, no cache.
- **No File Writes**: Read-only. Agent Lint provides guidance — your coding agent does the work.
- **Minimum Dependencies**: Published package under 500 KB packed.

## Related

- [`@agent-lint/cli`](https://www.npmjs.com/package/@agent-lint/cli) — CLI interface
- [Repository](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
