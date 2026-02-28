# Contributing to Agent Lint

Thank you for your interest in contributing to Agent Lint! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9

### Install & Build

```bash
git clone https://gitlab.com/bsamilozturk/agentlint.git
cd agentlint
pnpm install
pnpm run build
```

### Verify

```bash
pnpm run test        # Run all tests
pnpm run typecheck   # Type-check all packages
pnpm run lint        # ESLint
```

## Monorepo Structure

```
packages/
  shared/    → Common types, parser, conventions, schemas
  core/      → Deterministic analysis engine + 12-metric rules
  mcp/       → MCP server (stdio + HTTP transport)
  cli/       → CLI interface
```

**Dependency flow**: `shared ← core ← mcp` and `shared ← core ← cli`

**Build flow**: tsup bundles JS (shared+core inlined via `noExternal`) → tsc generates `.d.ts` only

### Published packages

| Package           | npm       |
| ----------------- | --------- |
| `@agent-lint/mcp` | Published |
| `@agent-lint/cli` | Published |

`@agent-lint/shared` and `@agent-lint/core` are internal — bundled into mcp and cli at build time.

## Development Workflow

1. **Fork & clone** the repository
2. **Create a branch** from `main`: `git checkout -b feat/my-feature`
3. **Make changes** following the coding standards below
4. **Run tests**: `pnpm run test`
5. **Run typecheck**: `pnpm run typecheck`
6. **Commit** with a semantic message (see below)
7. **Open a PR** against `main`

## Coding Standards

### TypeScript

- **Strict mode** — no `any`, no `@ts-ignore`, no `@ts-expect-error`
- All public functions must have explicit return types
- Prefer `type` over `interface` for data shapes

### Logging

- **`console.log()` is BANNED** — MCP uses stdio, so stdout is reserved for protocol messages
- Use `console.error()` for debug/info logging (goes to stderr)

### No State

- No databases, caches, or singletons
- Every function call is stateless — MCP server processes each request from scratch

### No Unguarded File Writes

- Read-only analysis is the default
- `apply_patches` is the only write path, and it requires: hash guard + extension allowlist + path traversal check + backup

### Dependencies

- Minimize new dependencies — every `pnpm add` needs justification
- Published package size must stay under 5 MB
- Forbidden: `express`, `lodash`, `axios`, `winston`, `chalk` (see `docs/dos_and_donts.md`)

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add custom rule validation
fix(mcp): handle empty artifact content
test(cli): add watch mode integration tests
docs: update CONTRIBUTING.md
chore: bump vitest to v4
```

**Scopes**: `shared`, `core`, `mcp`, `cli`, `rules`, `security`, `publish`, `http`

## Adding a New Metric

1. Add the metric ID to `packages/shared/src/types.ts`
2. Add scoring logic in `packages/core/src/analyzer.ts`
3. Add tests in `packages/core/tests/analyzer.test.ts`
4. Update the metric documentation in `README.md`

## Adding a Custom Rule

Users can create custom rules in `.agentlint/rules/`:

```typescript
import type { CustomRuleDefinition } from "@agent-lint/core";

const rule: CustomRuleDefinition = {
  id: "my-rule",
  metric: "clarity",
  label: "My Custom Rule",
  description: "Checks for something specific",
  requirement: "recommended",
  check: (context) => {
    const found = context.content.includes("something");
    return {
      status: found ? "pass" : "improve",
      evidence: found ? "Found it" : null,
      recommendation: "Add something to your artifact",
    };
  },
};

export default rule;
```

## Running Tests

```bash
pnpm run test              # All tests
pnpm run test:watch        # Watch mode
pnpm vitest packages/core  # Single package
```

Test files live next to source: `packages/<pkg>/tests/*.test.ts`

## Questions?

- Open a [GitLab Issue](https://gitlab.com/bsamilozturk/agentlint/-/issues)
- Check `docs/great_plan.md` for the project roadmap

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
