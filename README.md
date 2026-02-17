# Agent Lint

AI coding agents move fast. Agent Lint makes sure they move **safely, consistently, and measurably**.

Agent Lint evaluates and improves AI-agent context artifacts such as:

- `AGENTS.md` / `CLAUDE.md`
- skills
- rules
- workflows
- plans

It gives teams a practical quality layer for agent-driven development via:

- Web app
- CLI
- MCP server (`agentlint-local` stdio + `agentlint-remote` streamable HTTP)

---

## What Problem Does This Solve?

Most teams adopting coding agents hit the same issues:

- Context files drift over time and become inconsistent.
- Different engineers (or agents) produce different quality levels.
- "Looks good" reviews miss safety and export issues.
- Teams cannot explain *why* one artifact is better than another.

Agent Lint solves this by adding a reproducible quality workflow:

- clear scoring dimensions
- evidence-backed assessment
- guardrail checks
- repeatable improvement loops

---

## Who Is It For?

- **Platform / DevEx teams** building organization-wide agent standards
- **Engineering teams** scaling AI coding across multiple repos
- **Consultancies / agencies** needing repeatable quality across clients
- **Solo senior developers** who want strict quality gates before shipping prompts/rules/plans

---

## Without vs With Agent Lint

| Without Agent Lint | With Agent Lint |
|---|---|
| "This looks okay" | Structured scoring + evidence |
| Unclear quality bar | Explicit policy and target score |
| Ad-hoc rewrites | Guided fix loop with required tool order |
| Output-only review | Scoring transparency + guardrail breakdown |
| Inconsistent team standards | Shared, codified artifact quality system |
| Hidden export/safety risks | Final `validate_export` hard guardrail |

---

## Core Capabilities

### 1) Web + API path

- Input sanitization
- Artifact-specific prompting
- Multi-provider model execution (OpenAI/Anthropic/Gemini + fallback mock)
- Export safety validation
- Original/refined artifact storage + scoring

### 2) CLI

Local workflows for analyzing/fixing/scoring artifacts directly from terminal.

### 3) MCP path (client-led weighted scoring)

MCP clients (Cursor, Claude Desktop, VS Code-compatible tooling, Windsurf-like setups) can use Agent Lint as a quality orchestrator:

- Client LLM does repository scanning and evidence collection.
- Agent Lint MCP enforces scoring contract and guardrails.
- Final score is hybrid:
  - client weighted score: 90%
  - server guardrail score: 10%

---

## Architecture Snapshot

- **Frontend**: Next.js App Router + TypeScript
- **Styling/UI**: Tailwind CSS v4 + shadcn/ui
- **Backend**: tRPC + React Query
- **Data**: Drizzle ORM + SQLite (libSQL-compatible)
- **MCP**: `@modelcontextprotocol/sdk` (stdio + streamable HTTP)

---

## MCP: How `agentlint-remote` Works

Remote MCP endpoint (default local):

`http://127.0.0.1:3333/mcp`

Health/readiness:

- `GET /healthz`
- `GET /readyz`

Optional OAuth metadata:

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`

Authentication:

- `Authorization: Bearer <token>`
- configurable token scopes via `MCP_BEARER_TOKENS`

Session mode:

- default: stateful
- compatibility option: `MCP_HTTP_STATELESS=true` (for clients that do not preserve `Mcp-Session-Id`)

---

## MCP Tooling (What To Call, When)

### Primary flow tools

1. `prepare_artifact_fix_context`
2. `submit_client_assessment`
3. `quality_gate_artifact`
4. `validate_export`

### Advisory/support tools

- `analyze_artifact`
- `analyze_context_bundle`
- `suggest_patch`
- `analyze_workspace_artifacts` (local-first; remote-disabled by default)

### Recommended fix/update order

1. `prepare_artifact_fix_context`
2. read resources (`scoring-policy`, `assessment-schema`, `artifact-spec`, `artifact-path-hints`)
3. `submit_client_assessment`
4. `quality_gate_artifact` with `candidateContent + clientAssessment`
5. `validate_export`

---

## Prompts and Resources Exposed via MCP

### Prompts

- `artifact_create_prompt`
- `artifact_review_prompt`
- `artifact_fix_prompt`

### Resources

- `agentlint://quality-metrics/<type>`
- `agentlint://prompt-pack/<type>`
- `agentlint://prompt-template/<type>`
- `agentlint://artifact-path-hints/<type>`
- `agentlint://artifact-spec/<type>`
- `agentlint://scoring-policy/<type>`
- `agentlint://assessment-schema/<type>`
- `agentlint://improvement-playbook/<type>`

---

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure env

```bash
cp .env.example .env
```

### 3) Start app

```bash
npm run dev
```

---

## Scripts

- `npm run dev` - start Next.js app
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - run ESLint
- `npm run test` - run Vitest
- `npm run test:e2e` - run Playwright
- `npm run test:all` - run unit/integration + e2e
- `npm run cli` - Agent Lint CLI
- `npm run mcp:stdio` - local MCP server
- `npm run mcp:http` - remote streamable HTTP MCP server
- `npm run mcp:inspector` - MCP inspector against stdio server

---

## CLI Usage Examples

```bash
npm run cli -- analyze --type agents --file AGENTS.md --json
npm run cli -- fix --type rules --file docs/rules.md
npm run cli -- score --type workflows --content "# Workflow\n\n1. Run lint" --json
```

---

## MCP Installation: Different Client Patterns

Important: MCP client configuration formats vary by product/version. The snippets below use common `mcpServers` patterns widely used in the ecosystem.

### A) Cursor-style project config (`.cursor/mcp.json`)

#### Local stdio (`agentlint-local`)

```json
{
  "mcpServers": {
    "agentlint-local": {
      "command": "npx",
      "args": ["tsx", "src/mcp/stdio.ts"]
    }
  }
}
```

#### Remote HTTP (`agentlint-remote`)

```json
{
  "mcpServers": {
    "agentlint-remote": {
      "url": "https://your-domain.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### B) Claude Desktop-style config (`mcpServers` block)

```json
{
  "mcpServers": {
    "agentlint-local": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/agentlint/src/mcp/stdio.ts"]
    },
    "agentlint-remote": {
      "url": "https://your-domain.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### C) VS Code-compatible MCP setup

If your VS Code MCP integration supports JSON server entries, use the same pattern:

```json
{
  "mcpServers": {
    "agentlint-remote": {
      "url": "https://your-domain.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### D) Windsurf-like remote setup notes

- pass `Authorization: Bearer <token>`
- if session header errors appear (`400/404`), enable:

```env
MCP_HTTP_STATELESS=true
```

PowerShell token formatting tip:

```powershell
$TOKEN = "your-token"
$env:MCP_BEARER_TOKENS = "windsurf=${TOKEN}:*"
```

---

## Real-World Usage Scenarios

### Scenario 1: Build AGENTS.md from scratch

User intent:

"Create AGENTS.md for our monorepo with strict safety rules and explicit verification gates."

Flow:

1. `artifact_create_prompt`
2. `prepare_artifact_fix_context(type=agents)`
3. read `scoring-policy/agents`, `assessment-schema/agents`, `artifact-spec/agents`
4. `submit_client_assessment`
5. `quality_gate_artifact`
6. `validate_export`

Outcome:

- measurable quality, not subjective review

### Scenario 2: Fix low-scoring rules file

User intent:

"Improve this rules file to score above 90 and keep it concise."

Flow:

1. `artifact_fix_prompt`
2. `prepare_artifact_fix_context(type=rules)`
3. `submit_client_assessment`
4. `quality_gate_artifact` (+ `suggest_patch` if selective merge is needed)
5. `validate_export`

Outcome:

- patchable, traceable improvement loop with evidence

### Scenario 3: Review multiple context artifacts

User intent:

"Check whether AGENTS + workflows + roadmap are aligned before rollout."

Flow:

1. `analyze_context_bundle`
2. `prepare_artifact_fix_context`
3. `submit_client_assessment`
4. `quality_gate_artifact`
5. `validate_export`

Outcome:

- cross-document consistency with explicit guardrails

---

## Production Setup (Remote)

Minimum env:

```env
MCP_HTTP_HOST=0.0.0.0
MCP_HTTP_PORT=3333
MCP_PUBLIC_BASE_URL=https://your-domain.example.com
MCP_REQUIRE_AUTH=true
MCP_BEARER_TOKENS=client1=token-1:*;client2=token-2:analyze,validate
MCP_ENFORCE_TOOL_SCOPES=true
```

Container deploy:

```bash
docker build -f Dockerfile.mcp -t agentlint-mcp:latest .
docker run --rm -p 3333:3333 --env-file .env agentlint-mcp:latest
```

Post-deploy checks:

- `/healthz` returns 200
- `/readyz` returns 200
- unauthorized request returns 401
- scope violation returns 403

---

## Tips and Tactics

- Start fix loops with `prepare_artifact_fix_context` every time.
- Keep `agentlint-local` and `agentlint-remote` usage intentional:
  - local repo scan needed -> `agentlint-local`
  - shared/online setup needed -> `agentlint-remote`
- In remote mode, pass relevant file content explicitly when workspace scan is disabled.
- Use `targetScore` + `iterationIndex` + `previousFinalScore` in iterative improvement runs.
- Always run `validate_export` before final output.
- Use narrow scopes in production (`*` only for trusted/dev contexts).

---

## Security and Reliability Notes

- Bearer auth is enabled by default (`MCP_REQUIRE_AUTH=true`).
- Tool scope enforcement is available (`MCP_ENFORCE_TOOL_SCOPES=true`).
- Rate limiting, request size limits, timeouts, and concurrency limits are configurable.
- Session TTL and cleanup controls are available for long-lived deployments.
- Optional OAuth metadata endpoints supported for auth migration.

---

## Validation and Test Coverage

Integration coverage includes:

- authenticated/unauthenticated MCP HTTP flows
- stateful vs stateless behavior
- scope enforcement
- malformed JSON and session edge cases
- oauth metadata endpoints
- stdio end-to-end tool flow

Run targeted MCP tests:

```bash
npm run test -- tests/integration/mcp-http.test.ts tests/integration/mcp-auth.test.ts tests/integration/mcp-stdio.test.ts
```

---

## Additional Docs

- `docs/mcp_remote_runbook.md` - go-live and operations checklist
- `docs/mcp_client_conventions.md` - client invocation conventions
- `docs/mcp_phase6_contract.md` - MCP contract and flow
- `server.json` - optional MCP registry metadata template

---

## Positioning in One Line

Agent Lint is the quality control layer for AI coding agent context artifacts: fast to adopt, measurable by default, and production-friendly via local and remote MCP modes.
