## 2026-02-14 - Phase 6 Auto-Invoke Enhancements

### Delivered
- Strengthened MCP server instructions with policy-driven tool order for artifact QA.
- Added tool-level "when to use" descriptions and richer Zod field descriptions for better client-side tool selection.
- Added `quality_gate_artifact` tool for one-call analyze -> patch -> validate flow.
- Added `analyze_workspace_artifacts` local-first scanner tool (enabled in stdio, disabled by default in remote HTTP).

### Prompt and resource capabilities
- Added MCP prompts:
  - `artifact_create_prompt`
  - `artifact_review_prompt`
  - `artifact_fix_prompt`
- Added MCP resources:
  - `agentlint://quality-metrics/<type>`
  - `agentlint://prompt-pack/<type>`
  - `agentlint://prompt-template/<type>`

### Stability updates
- Added Windows-focused test runner guards:
  - `vitest.config.ts`: `maxWorkers=1` on win32
  - `playwright.config.ts`: `workers=1` on win32/non-CI

### Validation
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
