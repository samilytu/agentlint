# @agent-lint/mcp

MCP server for AI agent context artifact analysis and quality scoring.

**Zero LLM dependencies.** Fully deterministic. Local-first. No database. No auth.

## What It Does

Provides a [Model Context Protocol](https://modelcontextprotocol.io/) server that evaluates AI-agent context artifacts:

- `AGENTS.md` / `CLAUDE.md`
- Skills, Rules, Workflows, Plans

Reproducible quality scoring across **12 metrics**, evidence-backed assessment, guardrail checks, and repeatable improvement loops — all without calling any LLM.

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
    "agent-lint": {
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
    "agent-lint": {
      "command": "npx",
      "args": ["-y", "@agent-lint/mcp"]
    }
  }
}
```

### VS Code

Add to your VS Code `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "agent-lint": {
        "command": "npx",
        "args": ["-y", "@agent-lint/mcp"]
      }
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "agent-lint": {
      "command": "npx",
      "args": ["-y", "@agent-lint/mcp"]
    }
  }
}
```

## Available Tools

| Tool                           | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `analyze_artifact`             | Analyze a single artifact — returns scores across 12 metrics with findings and hints |
| `analyze_workspace_artifacts`  | Scan a workspace directory for AI agent artifacts with framework detection           |
| `analyze_context_bundle`       | Analyze multiple artifacts together for cross-artifact consistency                   |
| `prepare_artifact_fix_context` | Prepare context for an artifact improvement loop                                     |
| `submit_client_assessment`     | Submit a client LLM assessment with evidence-backed scores                           |
| `quality_gate_artifact`        | Check if an artifact meets a target quality score                                    |
| `suggest_patch`                | Generate patch suggestions to improve an artifact                                    |
| `apply_patches`                | Apply patches to local files with hash guard, allowlist, and backup protection       |
| `validate_export`              | Validate final artifact output for safety and correctness                            |

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
- **No File Writes**: Read-only by default. `apply_patches` requires explicit flags + hash guard.
- **Minimum Dependencies**: Published package under 500 KB packed.

## Related

- [`@agent-lint/cli`](https://www.npmjs.com/package/@agent-lint/cli) — CLI interface
- [Repository](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
