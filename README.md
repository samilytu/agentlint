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
- score any context artifact with `agent-lint score`
- use 5 MCP tools and 3 MCP resources to keep context artifacts aligned with the codebase

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
- Workspace scanning finds missing types, incomplete files, stale references, conflicting guidance, and weak-but-present context files from the codebase itself.
- `quick_check` flags when structural changes mean your agent instructions now need maintenance.
- Shared conventions make context quality reviewable instead of subjective.
- `prompt` and maintenance snippets turn context hygiene into a repeatable developer workflow with broad-scan and targeted-maintenance handoffs.

</td>
</tr>
</table>

## Quickstart

```bash
npx @agent-lint/cli
```

This opens an interactive session where you can run the core Agent Lint commands without leaving the terminal.

### Core commands

* `init` — set up MCP config and optionally install maintenance rules
* `doctor` — scan the workspace and generate a context maintenance report
* `prompt` — print a ready-to-paste prompt for your IDE chat
* `score <file>` — score a context artifact against 12 quality dimensions

Prefer a global install?

```bash
npm install -g @agent-lint/cli
agent-lint
```

Direct MCP only:

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
| `agent-lint doctor` | Scan the workspace and generate a context maintenance report grouped into missing types, incomplete files, stale, conflicting, and weak findings |
| `agent-lint prompt` | Print a ready-to-paste IDE prompt that chooses a broad workspace scan or a targeted maintenance handoff using current workspace findings and local change signals when available |
| `agent-lint score <file>` | Score a context artifact against 12 quality dimensions and print targeted improvement suggestions; artifact type is auto-detected from the filename or set with `--type` |

### MCP tools

| Tool | Purpose |
| --- | --- |
| `agentlint_get_guidelines` | Return artifact-specific guidance before creating or updating context files |
| `agentlint_plan_workspace_autofix` | Scan a workspace and return a step-by-step fix plan |
| `agentlint_quick_check` | Check whether recent code changes require context updates |
| `agentlint_emit_maintenance_snippet` | Return a reusable maintenance snippet for managed client files or `AGENTS.md` / `CLAUDE.md` fallbacks |
| `agentlint_score_artifact` | Score a context artifact against 12 quality dimensions and return targeted improvement suggestions for autoresearch loops |

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
  <kbd>Antigravity</kbd>
</p>

For exact formats and scope support, see:

- [CLI package README](packages/cli/README.md)
- [MCP package README](packages/mcp/README.md)

## Core Guarantees

- Local-first. No hosted LLM, no database, and no auth layer.
- Read-only MCP server. Agent Lint returns guidance; your client agent makes repository changes.
- Lightweight by design. Separate CLI and MCP packages, minimal dependencies, and strict TypeScript throughout.

## Why Agent Lint Takes This Shape

Agent Lint is informed by official documentation across the agent-tool ecosystem and by a narrower set of field reports from practitioners who document what actually improves agent output in real repositories. The overlap across those sources is consistent: keep context lean, make verification explicit, use progressive disclosure for specialized knowledge, and treat plans, workflows, and maintenance rules as operational artifacts rather than prompt dumps.

When a primary source exists, Agent Lint follows that source first. Community writing is used to compare patterns across tools and to stress-test what belongs in durable repository guidance.

### Official docs and specifications

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - context scoping, retrieval, and agent workflow design.
- [Anthropic Claude Code docs: Best practices](https://docs.claude.com/en/docs/claude-code/best-practices) - concise project instructions, verification loops, and durable project guidance.
- [Anthropic Claude Code docs: Memory](https://docs.claude.com/en/docs/claude-code/memory) - project memory hierarchy, local overrides, and how durable instructions are loaded.
- [Claude API docs: Skill authoring best practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) - progressive disclosure, metadata quality, and skill packaging guidance.
- [Lessons from Building Claude Code: How We Use Skills](https://x.com/trq212/status/2033949937936085378) - detailed real-world guidance from an Anthropic engineer on skill design and usage.
- [OpenAI Cookbook: Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans/) - long-running task decomposition and durable planning patterns.
- [AGENTS.md](https://agents.md/) - the open format and shared vocabulary for repository-level coding-agent guidance.
- [Windsurf Docs: AGENTS.md](https://docs.windsurf.com/windsurf/cascade/agents-md) - agent instruction file behavior in Windsurf.
- [Windsurf Docs: Workflows](https://docs.windsurf.com/windsurf/cascade/workflows) - workflow artifacts and repeatable agent execution paths.
- [GitHub Docs: Add custom instructions for Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/add-custom-instructions) - repository and user instruction surfaces for Copilot CLI.
- [Roo Code Docs: Custom Instructions](https://docs.roocode.com/features/custom-instructions) - repository and user-level instruction handling in Roo Code.

### Selected field notes and implementation reports

- [Addy Osmani: Agentic Engineering](https://addyosmani.com/blog/agentic-engineering/) - practical patterns for tool-using coding agents.
- [HumanLayer: Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) - concise instruction design, verification emphasis, and context hygiene.
- [Builder.io: Improve your AI code output with AGENTS.md](https://www.builder.io/blog/agents-md) - actionable repository guidance patterns for coding agents.
- [Sundeep Teki: From Vibe Coding to Context Engineering](https://www.sundeepteki.org/blog/from-vibe-coding-to-context-engineering-a-blueprint-for-production-grade-genai-systems) - production-oriented framing for context engineering systems.
- [Anthropic's guide to Claude Code best practices (discussion thread)](https://www.reddit.com/r/ClaudeAI/comments/1k5slll/anthropics_guide_to_claude_code_best_practices/) - practitioner discussion around real-world Claude Code usage.
- [Ole Lehmann: How to 10x your Claude Skills (using Karpathy's autoresearch method)](https://x.com/itsolelehmann/status/2033919415771713715) - autoresearch loop methodology that inspired `agentlint_score_artifact`: score → improve → compare → keep or revert.

Agent Lint does not mirror any one source directly. It uses the overlap between these references to shape workspace scanning, artifact guidance, maintenance snippets, and context-aware maintenance workflows, while keeping the repository code, tests, and package docs as the local source of truth.

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
