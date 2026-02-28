# Agent Lint — Project Context

## Purpose

Agent Lint is an OSS local-first static analysis tool for AI coding agent context artifacts:
- AGENTS.md / CLAUDE.md
- Skills
- Rules
- Workflows
- Plans

Fully deterministic. No LLM, no database, no auth.

## Stack

- TypeScript (strict)
- pnpm monorepo with project references
- tsup for bundling (ESM, `noExternal` for workspace deps)
- tsc for type declarations (`emitDeclarationOnly: true`)
- Vitest for testing (154 tests, 18 test files)
- `@modelcontextprotocol/sdk` for MCP server

## Monorepo Structure

```
packages/
  shared/    → Common types, parser, conventions, schemas
  core/      → Deterministic analysis engine + 12-metric rules
  mcp/       → MCP server (stdio transport) — PUBLIC npm package
  cli/       → CLI interface — PUBLIC npm package
```

Dependency flow: `shared ← core ← mcp` and `shared ← core ← cli`

Build flow: tsup bundles JS (shared+core inlined via `noExternal`) → tsc generates `.d.ts` only

## Rules

- Keep strict typing; no `any`.
- Never auto-execute destructive commands.
- `console.log()` is BANNED — all logs to stderr.
- MCP server produces data, not instructions. Client decides what to do.
- No state: no DB, no cache, no singletons. Every call is stateless.
- No unguarded file writes. Only `apply_patches` with hash-guard + allowlist + backup.
- Minimum dependencies. Every new dep needs justification. Package < 5MB.

## MCP Path (LLM-free, client-led scoring)

1. Sanitize user input.
2. Expose client-led scoring policy (metrics + weights + evidence schema) and artifact guidance resources.
3. Start fix loops with `prepare_artifact_fix_context`, then let MCP client LLM scan repository and produce evidence-backed scores.
4. Run `submit_client_assessment`, then low-weight server guardrails (safety/export/checklist) with hybrid final score.
5. Iterate rewrite → `quality_gate_artifact` (clientAssessment required by default) until target score and guardrails pass.

## Quality Metrics (12)

`clarity`, `specificity`, `scope-control`, `completeness`, `actionability`, `verifiability`, `safety`, `injection-resistance`, `secret-hygiene`, `token-efficiency`, `platform-fit`, `maintainability`

## MCP Tools (8)

| Tool | Purpose |
|------|---------|
| `analyze_artifact` | Single artifact analysis |
| `analyze_workspace_artifacts` | Workspace scanning + framework detection |
| `analyze_context_bundle` | Multi-artifact consistency analysis |
| `prepare_artifact_fix_context` | Fix loop context |
| `submit_client_assessment` | Submit client LLM assessment |
| `quality_gate_artifact` | Quality gate (target score check) |
| `suggest_patch` | Patch suggestion |
| `validate_export` | Final output validation |

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
# MCP: ~576 KB packed, ~3.7 MB unpacked
# CLI: ~325 KB packed, ~2.0 MB unpacked
```

Published packages: `@agent-lint/mcp` and `@agent-lint/cli`
Internal packages (bundled, not published): `@agent-lint/shared` and `@agent-lint/core`

## Reference Documents

- `docs/great_plan.md` — Master 7-phase plan
- `docs/dikkat_edilecekler.md` — Risks and pitfalls
- `docs/dos_and_donts.md` — Rules and constraints
