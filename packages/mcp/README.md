# @agent-lint/mcp

Read-only MCP server for keeping `AGENTS.md`, `CLAUDE.md`, rules, skills, workflows, and plans structured, current, and codebase-aware.

## Start the Server

```bash
npx -y @agent-lint/mcp
```

For most users, the fastest setup path is still:

```bash
npx @agent-lint/cli init
```

## Current Tool Surface

| Tool | Purpose |
| --- | --- |
| `agentlint_get_guidelines` | Return artifact guidance before creating or updating context files |
| `agentlint_plan_workspace_autofix` | Scan a workspace and return a step-by-step fix plan |
| `agentlint_quick_check` | Decide whether recent code changes require context updates |
| `agentlint_emit_maintenance_snippet` | Return a reusable maintenance snippet for managed client files or `AGENTS.md` / `CLAUDE.md` fallbacks |

## Current Resource Surface

| Resource | Purpose |
| --- | --- |
| `agentlint://guidelines/{type}` | Readable guidelines for one artifact type |
| `agentlint://template/{type}` | Skeleton template for a new artifact |
| `agentlint://path-hints/{type}` | IDE-specific file discovery hints |

## Programmatic Usage

```ts
import { createAgentLintMcpServer } from "@agent-lint/mcp";

const server = createAgentLintMcpServer({
  transportMode: "stdio",
});
```

## HTTP Transport

```bash
npx @agent-lint/mcp --http --port 3001
```

Notes:

- HTTP mode keeps the public surface read-only.
- Workspace scanning is disabled in HTTP mode unless you explicitly enable it.

## Design Constraints

- No server-side LLM calls
- No database or cache
- No file writes from the MCP server
- Local stderr logging only

## Related

- [Root README](https://github.com/samilozturk/agentlint)
- [CLI package](https://www.npmjs.com/package/@agent-lint/cli)
- [Authoritative publish source](https://gitlab.com/bsamilozturk/agentlint)

## License

MIT
