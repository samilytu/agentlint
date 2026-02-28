# @agent-lint/cli

CLI for AI agent context artifact analysis and quality scoring.

**Zero LLM dependencies.** Fully deterministic. Local-first. No database. No auth.

## What It Does

Static analysis tool that evaluates AI-agent context artifacts from the command line:

- `AGENTS.md` / `CLAUDE.md`
- Skills, Rules, Workflows, Plans

Reproducible quality scoring across **12 metrics** — perfect for CI/CD pipelines and local development.

## Quick Start

```bash
# Analyze a single artifact
npx @agent-lint/cli analyze AGENTS.md

# Scan entire workspace
npx @agent-lint/cli scan .

# Get numeric score
npx @agent-lint/cli score AGENTS.md
```

## Commands

### `analyze <path>`

Full analysis of a single artifact file.

```bash
agent-lint analyze AGENTS.md
agent-lint analyze AGENTS.md --type agents --verbose
agent-lint analyze AGENTS.md --json
agent-lint analyze AGENTS.md --watch
```

### `scan [dir]`

Scan a directory for all AI agent artifacts and analyze them.

```bash
agent-lint scan .
agent-lint scan . --json --fail-below 70
agent-lint scan ./docs --max-files 50
agent-lint scan . --watch
```

### `score <path>`

Output only the numeric quality score (useful for scripting).

```bash
agent-lint score AGENTS.md          # prints: 82
agent-lint score AGENTS.md --json   # prints JSON with score + dimensions
```

## Options

| Flag               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `--json`           | Output as JSON                                    |
| `--verbose`        | Show all metric details                           |
| `--quiet`          | Suppress operational logs                         |
| `--fail-below <n>` | Exit with code 1 if score < n (CI mode)           |
| `--type <type>`    | Artifact type: `agents` `skills` `rules` `workflows` `plans` |
| `--watch`          | Watch for file changes and re-analyze             |

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
      - run: npx -y @agent-lint/cli scan . --json --fail-below 70
```

## Exit Codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| `0`  | Success — all artifacts passed           |
| `1`  | At least one artifact below threshold    |
| `2`  | Configuration or usage error             |

## Quality Metrics (12)

`clarity` · `specificity` · `scope-control` · `completeness` · `actionability` · `verifiability` · `safety` · `injection-resistance` · `secret-hygiene` · `token-efficiency` · `platform-fit` · `maintainability`

## Supported Artifact Types

| Type      | File Patterns                                               |
| --------- | ----------------------------------------------------------- |
| Agents    | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| Rules     | `.cursor/rules/*.md`, `.windsurf/rules/*.md`                |
| Skills    | `skills/*.md`                                               |
| Workflows | `workflows/*.md`, `docs/workflows/*.md`                     |
| Plans     | `plans/*.md`, `docs/plans/*.md`                             |

## Related

- [`@agent-lint/mcp`](https://www.npmjs.com/package/@agent-lint/mcp) — MCP server for IDE integration
- [Repository](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
