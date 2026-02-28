# Agent Lint

Static analysis & quality scoring for AI coding agent context artifacts.

**Zero dependencies on LLMs.** Fully deterministic. Local-first. No database. No auth.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What It Does

Agent Lint evaluates and improves AI-agent context artifacts:

- `AGENTS.md` / `CLAUDE.md`
- Skills & Rules
- Workflows & Plans

It provides reproducible quality scoring across **12 metrics**, evidence-backed assessment, guardrail checks, and repeatable improvement loops — all without calling any LLM.

## Quick Start

### MCP Server

Add Agent Lint to your AI coding assistant with zero setup:

```bash
npx -y @agent-lint/mcp
```

### CLI

```bash
# Analyze a single artifact
npx @agent-lint/cli analyze AGENTS.md

# Scan entire workspace for artifacts
npx @agent-lint/cli scan .

# Get a numeric quality score
npx @agent-lint/cli score --type agents --file AGENTS.md

# CI mode: fail if score is below threshold
npx @agent-lint/cli analyze AGENTS.md --fail-below 70 --json
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

## MCP Tools

| Tool | Description |
|------|-------------|
| `analyze_artifact` | Analyze a single artifact — returns scores across 12 metrics with findings and hints |
| `analyze_workspace_artifacts` | Scan a workspace directory for AI agent artifacts with framework detection |
| `analyze_context_bundle` | Analyze multiple artifacts together for cross-artifact consistency |
| `prepare_artifact_fix_context` | Prepare context for an artifact improvement loop |
| `submit_client_assessment` | Submit a client LLM assessment with evidence-backed scores |
| `quality_gate_artifact` | Check if an artifact meets a target quality score |
| `suggest_patch` | Generate patch suggestions to improve an artifact |
| `validate_export` | Validate final artifact output for safety and correctness |

## Quality Metrics (12)

| Metric | What It Measures |
|--------|-----------------|
| `clarity` | How clear and unambiguous the instructions are |
| `specificity` | How specific and detailed the guidance is |
| `scope-control` | Whether boundaries and limitations are well-defined |
| `completeness` | Coverage of necessary topics and edge cases |
| `actionability` | Whether instructions can be directly acted upon |
| `verifiability` | Whether compliance can be objectively verified |
| `safety` | Presence of safety guardrails and constraints |
| `injection-resistance` | Resistance to prompt injection attacks |
| `secret-hygiene` | Absence of leaked secrets, keys, tokens |
| `token-efficiency` | Conciseness without sacrificing quality |
| `platform-fit` | Alignment with the target platform conventions |
| `maintainability` | How easy it is to update and maintain over time |

## CLI Reference

```
agent-lint analyze <path>     Analyze a single artifact
agent-lint scan [dir]         Scan workspace for artifacts
agent-lint score <options>    Get numeric quality score

Options:
  --json             Output as JSON
  --verbose          Show all metric details
  --quiet            Show only score and pass/fail
  --fail-below <n>   Exit with code 1 if score < n (CI mode)
  --type <type>      Artifact type: agents, skills, rules, workflows, plans
  --file <path>      Path to artifact file
```

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
      - ".github/copilot-instructions.md"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npx -y @agent-lint/cli scan . --json --fail-below 70
```

See [`examples/github-action.yml`](examples/github-action.yml) for the full example.

## Supported Artifact Types

| Type | File Patterns |
|------|--------------|
| Agents | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| Rules | `.cursor/rules/*.md`, `.windsurf/rules/*.md` |
| Skills | `skills/*.md` |
| Workflows | `workflows/*.md`, `docs/workflows/*.md` |
| Plans | `plans/*.md`, `docs/plans/*.md` |

## Architecture

```
packages/
  shared/    → Common types, parser, conventions, schemas
  core/      → Deterministic analysis engine + 12-metric rules
  mcp/       → MCP server (stdio transport)
  cli/       → CLI interface
```

| Package | Description | Published |
|---------|-------------|-----------|
| `@agent-lint/shared` | Common types, parser, conventions | No (bundled internally) |
| `@agent-lint/core` | Deterministic analysis engine + rules | No (bundled internally) |
| `@agent-lint/mcp` | MCP server (stdio transport) | **Yes** |
| `@agent-lint/cli` | CLI interface | **Yes** |

## Development

```bash
pnpm install
pnpm run build           # tsup bundle + tsc declarations
pnpm run typecheck       # tsc --build
pnpm run test            # vitest (154 tests)
pnpm run mcp:stdio       # Run MCP server locally
pnpm run mcp:inspector   # MCP Inspector
pnpm run cli             # Run CLI
```

## Design Principles

- **No LLM**: Fully deterministic analysis. No API calls, no tokens, no cost.
- **No State**: Every call is stateless. No database, no cache, no singletons.
- **No File Writes**: Read-only analysis. The only exception is `apply_patches` with explicit hash-guard + allowlist + backup.
- **Minimum Dependencies**: Every dependency is justified. Published packages are under 5MB.
- **MCP Data, Not Instructions**: The server produces analysis data. The client (Cursor/Claude/VS Code) decides what to do with it.

## License

MIT
