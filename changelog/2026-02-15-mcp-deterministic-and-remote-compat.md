## 2026-02-15 - MCP deterministic mode and remote compatibility hardening

### Delivered
- Migrated MCP analysis path to deterministic, LLM-free core (`analyze-artifact-mcp-core`).
- Updated `analyze_artifact` and `analyze_context_bundle` MCP tools to use deterministic scoring/output.
- Added artifact guidance resources:
  - `agentlint://artifact-path-hints/<type>`
  - `agentlint://artifact-spec/<type>`
- Extended `quality_gate_artifact`:
  - patch merge uses `candidateContent` when provided,
  - performs re-analysis after merge,
  - returns `initialScore -> score` trace.

### Remote runtime fixes
- Hardened stateless HTTP compatibility by using request-scoped MCP runtime in stateless mode.
- Added richer `GET /readyz` diagnostics:
  - capability flags,
  - advertised tool names,
  - prompt names,
  - resource templates.
- Enabled `.env` auto-load in MCP entrypoints (`src/mcp/http/server.ts`, `src/mcp/stdio.ts`).

### Tests and validation
- Expanded MCP integration coverage for prompts/resources and stateless mode.
- Validated with:
  - `npm run lint`
  - `npm run test`
  - `npm run test:e2e`
  - `npm run build`
