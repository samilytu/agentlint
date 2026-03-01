# Agent Lint — Project Context

## Purpose

Agent Lint is a meta-agent orchestrator for AI coding agent context artifacts:

- AGENTS.md / CLAUDE.md
- Skills
- Rules
- Workflows
- Plans

It provides guidelines, action plans, and maintenance rules to client-side LLMs.
The client LLM does all file reading and writing — Agent Lint never writes files.
No LLM server-side, no database, no auth.

## Stack

- TypeScript (strict)
- pnpm monorepo with project references
- tsup for bundling (ESM, `noExternal` for workspace deps)
- tsc for type declarations (`emitDeclarationOnly: true`)
- Vitest for testing (106 tests, 12 test files)
- `@modelcontextprotocol/sdk` for MCP server

## Monorepo Structure

```
packages/
  shared/    → Common types, parser, conventions, schemas
  core/      → Guidelines, workspace discovery, plan building
  mcp/       → MCP server (stdio + HTTP transport) — PUBLIC npm package
  cli/       → CLI interface — PUBLIC npm package
```

Dependency flow: `shared ← core ← mcp` and `shared ← core ← cli`

Build flow: tsup bundles JS (shared+core inlined via `noExternal`) → tsc generates `.d.ts` only

## Rules

- Keep strict typing; no `any`.
- Never auto-execute destructive commands.
- `console.log()` is BANNED — all logs to stderr.
- MCP server provides guidance, not instructions. Client LLM decides what to do.
- No state: no DB, no cache, no singletons. Every call is stateless.
- Zero file writes from MCP server. Client LLM handles all file operations.
- Minimum dependencies. Every new dep needs justification. Package < 5MB.

## MCP Tools (4)

| Tool                                 | Purpose                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `agentlint_get_guidelines`           | Full guidelines for creating/updating an artifact type |
| `agentlint_plan_workspace_autofix`   | Scan workspace, return step-by-step fix plan           |
| `agentlint_quick_check`              | Check if code changes require context artifact updates |
| `agentlint_emit_maintenance_snippet` | Persistent rule snippet for IDE clients                |

## MCP Resources (3)

| Resource                        | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `agentlint://guidelines/{type}` | Same as get_guidelines tool, as a readable resource |
| `agentlint://template/{type}`   | Skeleton template for new artifacts                 |
| `agentlint://path-hints/{type}` | File discovery patterns per IDE client              |

## CLI Commands (3)

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `agent-lint init`   | Set up MCP config for detected IDE clients |
| `agent-lint doctor` | Scan workspace and generate fix report     |
| `agent-lint prompt` | Print copy-paste prompt for IDE chat       |

## Quality Metrics (12)

`clarity`, `specificity`, `scope-control`, `completeness`, `actionability`, `verifiability`, `safety`, `injection-resistance`, `secret-hygiene`, `token-efficiency`, `platform-fit`, `maintainability`

## Development

```bash
pnpm install
pnpm run build           # tsup bundle + tsc declarations
pnpm run typecheck       # tsc --build (all packages)
pnpm run test            # vitest
pnpm run mcp:stdio       # Run MCP server
pnpm run mcp:inspector   # MCP Inspector
pnpm run cli             # CLI
```

## Publishing

```bash
pnpm run build                  # Build all packages
npm pack --dry-run               # Verify package contents (in packages/mcp or packages/cli)
```

Published packages: `@agent-lint/mcp` and `@agent-lint/cli`
Internal packages (bundled, not published): `@agent-lint/shared` and `@agent-lint/core`

## Reference Documents

- `docs/great_plan.md` — Master plan (pre-pivot reference)
- `docs/dikkat_edilecekler.md` — Risks and pitfalls
- `docs/dos_and_donts.md` — Rules and constraints
