# Faz 6 MCP + CLI Contract

Bu dokuman Faz 6 icin teknik kontrati kilitler.

## Scope

- Iki transport ayni kod tabaninda:
  - local: `stdio`
  - remote: `streamable-http`
- MCP tools:
  - `analyze_artifact`
  - `analyze_context_bundle`
  - `quality_gate_artifact`
  - `suggest_patch`
  - `validate_export`
  - `analyze_workspace_artifacts` (local stdio)
- CLI komutlari:
  - `analyze`
  - `fix`
  - `score`

## Runtime Design

- MCP server factory: `src/mcp/core/create-server.ts`
- Tool wrappers: `src/mcp/tools/*.ts`
- Local stdio entrypoint: `src/mcp/stdio.ts`
- Remote HTTP entrypoint: `src/mcp/http/server.ts`
- Prompt registry: `src/mcp/prompts/register-prompts.ts`
- Resource registry: `src/mcp/resources/register-resources.ts`

## Shared Business Logic

Duplicate logic engeli icin ortak analiz akisi:

- `src/server/services/analyze-artifact-core.ts` (Web/API + CLI provider-capable path)
- `src/server/services/analyze-artifact-mcp-core.ts` (MCP deterministic LLM-free path)
- `src/server/services/context-bundle.ts`

Web/API ve CLI path provider-capable cekirdegi kullanir.
MCP tools deterministic cekirdegi kullanir.

## Remote Security Baseline

- Bearer auth middleware (`MCP_REQUIRE_AUTH=true` varsayilan)
- Tool scope enforcement (`analyze`, `validate`, `patch`)
- Token/IP rate limit
- Request body limit
- Timeout guard
- Max concurrent request guard
- Session TTL + periodic cleanup
- DNS rebinding guard (`createMcpExpressApp`)

## OAuth Migration Path

Beta auth aktifken, production OAuth gecisi icin metadata endpointleri eklendi:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`

Gerekli issuer/token endpoint env degiskenleri eklendiginde metadata endpointi aktif olur.

## Tests

- `tests/integration/mcp-stdio.test.ts`
- `tests/integration/mcp-http.test.ts`
- `tests/integration/mcp-auth.test.ts`
- `tests/integration/cli-smoke.test.ts`

## Auto-Invoke Convention

Server instructions and tool descriptions are intentionally policy-driven:

1. `quality_gate_artifact`
2. `analyze_artifact` / `analyze_context_bundle` (when deeper context diagnostics are needed)
3. `validate_export`

Prompt and resource capabilities are exposed to improve client-side selection behavior.

## Operational Scripts

- `npm run mcp:stdio`
- `npm run mcp:http`
- `npm run mcp:inspector`
- `npm run cli -- <command>`
