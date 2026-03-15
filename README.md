# Agent Lint

### **ESLint for your coding agents.**

Bad context = bad code.

Keep `AGENTS.md`/`CLAUDE.md`, skills, rules, workflows, and plans well-structured, up to date, and aligned with the codebase.

Agent Lint helps coding agents maintain the files that shape how they work: `AGENTS.md`/`CLAUDE.md`, skills, rules, workflows, and plans. The CLI can automatically add MCP client config when you run `init`. Once initialized, Agent Lint keeps your context files sharp and current through MCP and maintenance rules.

[CLI on npm](https://www.npmjs.com/package/@agent-lint/cli) | [MCP on npm](https://www.npmjs.com/package/@agent-lint/mcp) | [GitHub](https://github.com/samilozturk/agentlint) | [GitLab](https://gitlab.com/bsamilozturk/agentlint)

![Agent Lint doctor demo](docs/screenshots/demo-doctor.svg)

## The Problem

Your `AGENTS.md`, `CLAUDE.md`, skills, rules, workflows, and plans are the operating system of your coding agent. They shape how the agent plans, writes code, and makes decisions.

Without a standard, agent context files drift fast:

- `AGENTS.md` and rules are written once and forgotten.
- New modules, scripts, or workflows appear, but the context never catches up.
- Different developers write different styles of instructions.
- Agents generate vague, repetitive context that costs tokens and misses project details.

Agent Lint gives your coding agent a repeatable workflow:

- set up MCP config with `agent-lint init`
- scan the workspace with `agent-lint doctor`
- paste a ready-made prompt with `agent-lint prompt`
- use 4 MCP tools and 3 MCP resources to keep context artifacts aligned with the codebase

## Without vs With Agent Lint

<table width="100%">
<tr>
<td width="50%" valign="top">

### Without Agent Lint

- `AGENTS.md` starts as a one-off prompt dump and quietly goes stale.
- New scripts, modules, and workflows land, but agent context never catches up.
- Each developer invents their own rules format, so agent behavior drifts across repos.
- Nobody can tell whether a context file is actually actionable, safe, or complete.
- Agents keep re-generating generic boilerplate that burns tokens and misses project specifics.

</td>
<td width="50%" valign="top">

### With <font color="#84B179">A</font><font color="#93BE82">g</font><font color="#A2CB8B">e</font><font color="#B5DAA3">n</font><font color="#C7EABB">t</font> <font color="#D8EFBC">L</font><font color="#D8EFBC">i</font><font color="#E8F5BD">n</font><font color="#E8F5BD">t</font>

- Artifact-specific guidance tells the agent what good looks like before it edits anything.
- Workspace scanning finds missing, stale, and incomplete context files from the codebase itself.
- `quick_check` flags when structural changes mean your agent instructions now need maintenance.
- Shared conventions make context quality reviewable instead of subjective.
- `prompt` and maintenance snippets turn context hygiene into a repeatable developer workflow.

</td>
</tr>
</table>

## 60-Second Quickstart

Install nothing up front:

```bash
npx @agent-lint/cli init
npx @agent-lint/cli doctor
npx @agent-lint/cli prompt
```

If you prefer `npm`:

```bash
npm install -g @agent-lint/cli
agent-lint init
agent-lint doctor
agent-lint prompt
```

What each step does:

1. `init` detects supported IDE clients, writes the right MCP config entry, and can install maintenance rules.
2. `doctor` scans the repository and creates a workspace report.
3. `prompt` prints a ready-to-paste prompt for your IDE chat so the agent can act on the report.

If you add maintenance rules, rerunning `init` updates managed rule files cleanly instead of duplicating them.

If you prefer direct MCP usage:

```bash
npx -y @agent-lint/mcp
```

## Let Your Agent Drive the Work

Once Agent Lint is connected, most coding agents can infer when to use it from a natural language prompt.

```text
agent-lint init  ->  agent-lint doctor  ->  agent-lint prompt
connect MCP          scan workspace         hand off into IDE chat
```

Try prompts like:

- `Review this repo's agent context files, fix anything stale or missing, and apply safe context-artifact updates directly.`
- `I changed module structure and CI config. Update only the context files affected by those changes.`
- `Add a persistent maintenance rule so AGENTS.md, rules, skills, workflows, and plans stay current after future structural changes.`

In practice, this lets the agent scan the workspace, use the right guidance before editing, and add ongoing maintenance rules where supported.

**Environment-Aware Context Targeting**

By default, Agent Lint anchors your context in the industry-standard `AGENTS.md`. However, it natively detects your active IDE and automatically routes maintenance rules to the optimal location:

- **`AGENTS.md`**: The universal standard and default target for most coding agents.
- **`CLAUDE.md`**: Preferred and targeted automatically for Claude-family clients.
- **Managed Rule Files**: Specifically optimized for Cursor and Windsurf workflows.
- **`.github/copilot-instructions.md`**: Seamlessly appended with a maintenance block for VS Code / GitHub Copilot users.

## What You Get

### CLI commands

| Command | Purpose |
| --- | --- |
| `agent-lint init` | Set up Agent Lint MCP config and optionally install maintenance rules |
| `agent-lint doctor` | Scan the workspace and generate a context maintenance report |
| `agent-lint prompt` | Print a ready-to-paste IDE prompt that tells the agent what to do next |

### MCP tools

| Tool | Purpose |
| --- | --- |
| `agentlint_get_guidelines` | Return artifact-specific guidance before creating or updating context files |
| `agentlint_plan_workspace_autofix` | Scan a workspace and return a step-by-step fix plan |
| `agentlint_quick_check` | Check whether recent code changes require context updates |
| `agentlint_emit_maintenance_snippet` | Return a reusable maintenance snippet for managed client files or `AGENTS.md` / `CLAUDE.md` fallbacks |

### MCP resources

| Resource | Purpose |
| --- | --- |
| `agentlint://guidelines/{type}` | Readable guidelines for one artifact type |
| `agentlint://template/{type}` | Skeleton template for a new artifact |
| `agentlint://path-hints/{type}` | File discovery hints for each IDE client |

## Supported Clients

`agent-lint init` supports:

<p>
  <kbd>Claude Code</kbd>
  <kbd>Codex</kbd>
  <kbd>Cursor</kbd>
  <kbd>OpenCode</kbd>
  <kbd>Windsurf</kbd>
  <kbd>Claude Desktop</kbd>
  <kbd>VS Code</kbd>
  <kbd>Kilo Code</kbd>
  <kbd>Cline</kbd>
  <kbd>Roo Code</kbd>
  <kbd>Kiro</kbd>
  <kbd>Zed</kbd>
</p>

For exact formats and scope support, see:

- [CLI package README](packages/cli/README.md)
- [MCP package README](packages/mcp/README.md)

## Core Guarantees

- Local-first. No hosted LLM, no database, and no auth layer.
- Read-only MCP server. Agent Lint returns guidance; your client agent makes repository changes.
- Lightweight by design. Separate CLI and MCP packages, minimal dependencies, and strict TypeScript throughout.

## Contributing

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run test
```

Public contribution guidance lives in [CONTRIBUTING.md](CONTRIBUTING.md). Release steps live in [PUBLISH.md](PUBLISH.md).

## License

[MIT](LICENSE)
