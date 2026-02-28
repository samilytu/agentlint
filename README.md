<div align="center">

<img src="https://img.shields.io/npm/v/@agent-lint/cli?color=%234f46e5&label=CLI&style=for-the-badge" alt="CLI Version" />
<img src="https://img.shields.io/npm/v/@agent-lint/mcp?color=%234f46e5&label=MCP&style=for-the-badge" alt="MCP Version" />
<img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT Licensed" />
<img src="https://img.shields.io/badge/LLM-not%20required-green?style=for-the-badge" alt="No LLM Required" />

# Agent Lint

### **The Linter for Your AI Coding Agents.**

Your code has ESLint. Your agents deserve **Agent Lint**.

[Quick Start](#-quick-start) · [Installation](#-installation) · [CLI Usage](#-cli-usage) · [MCP Tools](#-mcp-tools) · [CI/CD](#-cicd-integration)

</div>

---

## The Problem

Your `AGENTS.md`, `CLAUDE.md`, cursor rules, and skills files are **the operating system of your coding agent.** They control how your agent thinks, writes code, and makes decisions.

**Bad context = bad code.** It's that simple.

Yet most teams either:

- Write these files once and never revisit them
- Let their coding agent generate its own context — producing **generic, bloated, unfocused instructions**
- Have no way to measure whether their context files actually _help_ or just waste tokens

There's no ESLint for agent context. No Prettier. No quality gate.

**Until now.**

---

<table>
<tr>
<td width="50%">

### ❌ Without Agent Lint

&nbsp;

❌ Vague, generic instructions that **waste thousands of tokens** every prompt

❌ Coding agents write their own context files — output is often **repetitive and low-quality**

❌ No way to know if your `AGENTS.md` actually **improves** agent behavior

❌ Prompt injection vulnerabilities and **leaked secrets** go undetected

❌ Every developer writes context files differently — **zero consistency**

❌ No quality gate in CI/CD — bad context ships to production

</td>
<td width="50%">

### ✅ With Agent Lint

&nbsp;

✅ **12-metric scoring** against curated best practices from official sources

✅ Instantly catch token waste, vague instructions, and security issues

✅ **Deterministic results** — same file, same score, every time

✅ Works as **MCP server** in your IDE or **CLI** in your terminal

✅ Scoring rules compiled from **official platform documentation** — not AI-generated

✅ Drop into CI/CD — **lint context artifacts like you lint code**

</td>
</tr>
</table>

> **Your agents are only as good as the context you give them.**
> Stop guessing. Start linting.

---

## 🚀 Quick Start

Score any context artifact in one command:

```bash
npx @agent-lint/cli score AGENTS.md
```

```
91
```

That's it. No install, no config, no API keys.

### See What's Wrong

```bash
npx @agent-lint/cli analyze AGENTS.md
```

```
Artifact: AGENTS.md
Type:     agents
Score:    91
Dimensions: clarity=95, safety=86, tokenEfficiency=95, completeness=89

Warnings:
  - Potential shell injection pattern detected.
```

### Scan Your Entire Workspace

```bash
npx @agent-lint/cli scan .
```

```
Path                              Type       Score
--------------------------------- ---------- -----
AGENTS.md                         agents       91
.cursor/rules/code-style.md       rules        78
docs/deployment-plan.md           plans        65
skills/react-patterns.md          skills       82

Artifacts: 4
Average score: 79
```

---

## 📦 Installation

### MCP Server (Recommended)

Add Agent Lint directly into your AI coding assistant. It scores and improves your context artifacts **while you work**.

<details open>
<summary><b>Cursor</b></summary>

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

</details>

<details>
<summary><b>Windsurf</b></summary>

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

</details>

<details>
<summary><b>Claude Desktop</b></summary>

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

</details>

<details>
<summary><b>VS Code / GitHub Copilot</b></summary>

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

</details>

### CLI

```bash
npx @agent-lint/cli analyze AGENTS.md

npm install -g @agent-lint/cli
agent-lint analyze AGENTS.md
```

---

## 💡 CLI Usage

```bash
# Score a file (just the number)
agent-lint score AGENTS.md

# Full analysis with findings and warnings
agent-lint analyze AGENTS.md

# Scan entire project
agent-lint scan .

# JSON output for programmatic use
agent-lint analyze AGENTS.md --json

# CI mode — fail if quality drops below threshold
agent-lint analyze AGENTS.md --fail-below 70

# Verbose — see all 12 metric scores
agent-lint analyze AGENTS.md --verbose

# Quiet — just pass/fail, no noise
agent-lint scan . --quiet --fail-below 60

# Specify artifact type explicitly
agent-lint analyze my-rules.md --type rules

# Scan with file limit
agent-lint scan . --max-files 10
```

<details>
<summary><b>Full CLI Reference</b></summary>

```
Usage: agent-lint [options] [command]

Commands:
  analyze <path>     Analyze a single artifact file
  scan [dir]         Scan workspace for artifact files
  score <path>       Output only the quality score

Options:
  --json             Output as JSON
  --verbose          Show all metric details
  --quiet            Suppress operational logs
  --fail-below <n>   Exit code 1 if score < n
  --type <type>      agents | skills | rules | workflows | plans
  --max-files <n>    Limit files to scan
  -V, --version      Show version
  -h, --help         Show help
```

</details>

---

## 📊 12 Quality Metrics

Every artifact is scored across **12 dimensions** — curated from official platform documentation, security research, and production-tested best practices:

| Metric                   | What It Measures                                 |
| :----------------------- | :----------------------------------------------- |
| **Clarity**              | Are instructions clear and unambiguous?          |
| **Specificity**          | Is guidance detailed enough to act on?           |
| **Scope Control**        | Are boundaries and limitations well-defined?     |
| **Completeness**         | Are all necessary topics and edge cases covered? |
| **Actionability**        | Can instructions be directly followed?           |
| **Verifiability**        | Can compliance be objectively verified?          |
| **Safety**               | Are there proper guardrails and constraints?     |
| **Injection Resistance** | Is the artifact resistant to prompt injection?   |
| **Secret Hygiene**       | Are there any leaked secrets, keys, or tokens?   |
| **Token Efficiency**     | Is it concise without sacrificing quality?       |
| **Platform Fit**         | Does it align with the target platform?          |
| **Maintainability**      | How easy is it to update and maintain?           |

> **These aren't arbitrary rules.** Every metric is backed by real-world evaluation criteria compiled from Cursor, Windsurf, Claude, GitHub Copilot, and community-driven best practices.

---

## 🔧 MCP Tools

When running as an MCP server, Agent Lint provides **9 tools** your coding agent can use directly:

| Tool                           | What It Does                                               |
| :----------------------------- | :--------------------------------------------------------- |
| `analyze_artifact`             | Score a single artifact across 12 quality metrics          |
| `analyze_workspace_artifacts`  | Discover and score all context artifacts in your workspace |
| `analyze_context_bundle`       | Check consistency across multiple related artifacts        |
| `prepare_artifact_fix_context` | Start an evidence-based improvement loop                   |
| `submit_client_assessment`     | Submit quality scores with metric-level evidence           |
| `quality_gate_artifact`        | Pass/fail gate against a target quality threshold          |
| `suggest_patch`                | Generate targeted improvement suggestions                  |
| `apply_patches`                | Apply fixes with SHA-256 hash-guard + backup protection    |
| `validate_export`              | Final safety validation before export                      |

**Example prompt to your agent:**

```
Analyze my AGENTS.md with agent-lint and fix any issues found.
Target score: 85+
```

Your coding agent will use Agent Lint's MCP tools to analyze, score, and iteratively improve the artifact — all within your IDE.

---

## 🔄 CI/CD Integration

Lint your agent context on every pull request — just like you lint code:

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
      - run: npx -y @agent-lint/cli scan . --json --fail-below 70
```

### GitLab CI

```yaml
agent-lint:
  image: node:20
  script:
    - npx -y @agent-lint/cli scan . --json --fail-below 70
  rules:
    - changes:
        - AGENTS.md
        - CLAUDE.md
```

---

## 📁 Supported Artifacts

| Type          | File Patterns                                               |
| :------------ | :---------------------------------------------------------- |
| **Agents**    | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| **Rules**     | `.cursor/rules/*.md`, `.windsurf/rules/*.md`                |
| **Skills**    | `skills/*.md`                                               |
| **Workflows** | `workflows/*.md`, `docs/workflows/*.md`                     |
| **Plans**     | `plans/*.md`, `docs/plans/*.md`                             |

---

## 🧠 Design Principles

| Principle                  | Detail                                                              |
| :------------------------- | :------------------------------------------------------------------ |
| **No LLM**                 | Fully deterministic. No API calls, no tokens, no cost.              |
| **No State**               | Every call is stateless. No database, no cache.                     |
| **No File Writes**         | Read-only by default. `apply_patches` requires explicit hash-guard. |
| **Minimum Deps**           | Published packages < 5 MB.                                          |
| **Data, Not Instructions** | MCP server provides data — your agent decides what to do.           |

---

## 🏗️ Architecture

```
packages/
  shared/    → Common types, parser, schemas
  core/      → Deterministic analysis engine + 12-metric rules
  mcp/       → MCP server (stdio transport)
  cli/       → CLI interface
```

| Package           | Status                                                                                                                |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `@agent-lint/mcp` | [![npm](https://img.shields.io/npm/v/@agent-lint/mcp?color=%234f46e5)](https://www.npmjs.com/package/@agent-lint/mcp) |
| `@agent-lint/cli` | [![npm](https://img.shields.io/npm/v/@agent-lint/cli?color=%234f46e5)](https://www.npmjs.com/package/@agent-lint/cli) |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

```bash
pnpm install
pnpm run build
pnpm run test          # 154 tests
pnpm run typecheck
```

---

## License

[MIT](LICENSE)

---

<div align="center">

**Your code has ESLint. Your agents deserve Agent Lint.**

**[Get Started →](#-quick-start)**

</div>
