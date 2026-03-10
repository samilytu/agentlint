# MCP Package

## Do

- Keep tool IDs, resource URIs, and timeouts aligned across `src/catalog.ts`, runtime registration, package README, and docs-consistency tests.
- Keep every tool read-only, idempotent, timeout-wrapped, and schema-validated through shared inputs.
- Use `logMcp` and stderr JSON logging only.
- Keep HTTP mode conservative: loopback default, workspace scan opt-in, and no extra web framework.

## Do Not

- Do not add file writes, caches, singletons, or server-side LLM calls.
- Do not weaken auth, origin, host, or rate-limit protections.
- Do not change the current tool or resource surface without updating docs and tests in the same change.

## Repository Evidence

- `src/server.ts`: server factory, instructions, and registration.
- `src/catalog.ts`: authoritative tool IDs, resource URIs, and timeout values.
- `src/http.ts`, `src/http-security.ts`, `src/transport-security.ts`: HTTP transport and safety guards.
- `tests/*.test.ts`: tools, docs consistency, stdio, HTTP, and security coverage.

## Clarification Gate

- Ask only if a change alters tool IDs, transport behavior, or public security defaults and the target behavior is not already in code, docs, or tests.

## Quick Commands

- `pnpm --filter @agent-lint/mcp run build`
- `pnpm run typecheck:mcp`
- `pnpm exec vitest run packages/mcp/tests`
- `pnpm run mcp:stdio`
- `pnpm run mcp:inspector`
- `npm pack --dry-run` from `packages/mcp`

## Repo Map

- `src/bin.ts`: package entrypoint.
- `src/server.ts`: server construction and instructions.
- `src/tools/`: tool registration and handlers.
- `src/resources/`: MCP resources.
- `src/prompts/`: prompt registration.
- `src/http*.ts` and `src/transport-security.ts`: transport and request guards.
- `tests/`: transport, security, tooling, and docs consistency coverage.

## Working Rules

- Update `packages/mcp/README.md`, root README references, and `tests/docs-consistency.test.ts` in the same change as surface updates.
- Keep tool annotations accurate: `readOnlyHint`, `idempotentHint`, and `destructiveHint`.
- Use shared schemas and core builders instead of custom parsing inside handlers.
- Preserve `CURRENT_TOOL_TIMEOUTS` and legacy timeout aliases when adding or moving tools.

## When Stuck

- Compare `src/catalog.ts`, the package README, and `tests/docs-consistency.test.ts` first.
- If behavior differs between stdio and HTTP, debug registration, transport wiring, and `enableWorkspaceScan` separately.
- Escalate before any change that would make the MCP server write files or depend on hosted services.

## Verification

- `pnpm --filter @agent-lint/mcp run build`
- `pnpm run typecheck:mcp`
- `pnpm exec vitest run packages/mcp/tests/docs-consistency.test.ts`
- `pnpm exec vitest run packages/mcp/tests/http.test.ts packages/mcp/tests/http-security.test.ts packages/mcp/tests/tools.test.ts`
- `npm pack --dry-run` from `packages/mcp`

## Security

- HTTP must stay loopback-only by default.
- Keep bearer token, host/origin validation, and rate limiting intact.
- Never log secrets or raw auth tokens.
- Treat prompt and resource text as guidance only; the client LLM performs edits.

## PR Checklist

- Tool and resource docs align with `src/catalog.ts`.
- Runtime registration and tests were updated together.
- No new write path, cache, or stateful coordination was introduced.
- Packaging output still stays within `dist/`, `README.md`, `CHANGELOG.md`, and `LICENSE`.
