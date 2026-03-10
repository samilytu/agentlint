# Scope and Goals

- Keep the repository's core context artifacts aligned with the current monorepo surface, public package boundaries, and supported IDE clients.
- Maintain one root AGENTS file plus package-scoped AGENTS for `packages/mcp` and `packages/cli`.
- Keep maintenance rules, one workflow doc, and one plan doc available so Agent Lint can guide future context updates with less guesswork.

# Non-Goals

- Adding new MCP tools or CLI commands.
- Building a large skill library before repeated workflows justify it.
- Automating publish, tag, or mirror decisions.

# Current-State Assumptions

- The public surface is four MCP tools, three MCP resources, and three CLI commands.
- Supported clients include Cursor, Windsurf, VS Code, Claude Desktop, Claude Code, Codex, OpenCode, Cline, Kiro, and Zed.
- GitLab remains the authoritative release path; GitHub stays public-facing for docs and issues.
- Root scripts and package READMEs are the source of truth for verification commands and public behavior.

# Risks and Dependencies

- Public docs can drift when tool IDs, resource URIs, or supported clients change in code first.
- Maintenance instructions can drift across Cursor, Windsurf, Copilot, and Codex if they are not updated together.
- Package-scoped AGENTS can go stale if root context changes without package follow-up.
- This plan depends on `README.md`, package READMEs, `CONTRIBUTING.md`, `PUBLISH.md`, and docs-consistency tests staying current.

# Phases with Checklists

## Phase 1: Baseline Coverage

- [x] Rewrite the root `AGENTS.md` to match current repository evidence and Agent Lint guidance.
- [x] Add package-scoped AGENTS files for `packages/mcp` and `packages/cli`.
- [x] Align Cursor, Windsurf, and Copilot maintenance instructions with the current Agent Lint workflow.
- [x] Add a Codex exec-policy rules file for destructive and release-sensitive commands.
- [x] Add a release workflow doc and a context-maintenance plan doc.

## Phase 2: Ongoing Hygiene

- [ ] Re-run `agentlint_plan_workspace_autofix` after structural context changes.
- [ ] Use `agentlint_quick_check` for targeted dependency, config, CI, or directory changes.
- [ ] Keep maintenance snippets aligned across clients when Agent Lint tool order changes.
- [ ] Review package-scoped AGENTS whenever `packages/mcp/README.md` or `packages/cli/README.md` changes.

## Phase 3: Optional Expansion

- [ ] Add a release-triage skill if publish, provenance, or package dry-run tasks become frequent.
- [ ] Add a docs-surface audit skill if README and docs-consistency updates become repetitive.
- [ ] Consider `.agents/` canonical nested policies if more IDEs need package-scoped context discovery.

# Verification Commands and Acceptance Criteria

- `pnpm exec vitest run packages/cli/tests/docs-consistency.test.ts packages/mcp/tests/docs-consistency.test.ts packages/cli/tests/maintenance-writer.test.ts`
- `codex execpolicy check --pretty --rules .codex/rules/default.rules -- git push origin main`
- `codex execpolicy check --pretty --rules .codex/rules/default.rules -- git reset --hard HEAD`
- `agentlint_plan_workspace_autofix` reports no missing sections for touched canonical artifacts.
- Acceptance criteria: root context, maintenance rules, skill, workflow, and plan files are present, concise, and aligned with repository evidence.

# Delivery Evidence

- Files created or updated: root AGENTS, package AGENTS, maintenance rules, Codex rules, one workflow doc, one plan doc, and one repaired skill.
- Validation evidence: targeted docs and maintenance checks pass, and a fresh Agent Lint workspace scan no longer reports missing sections for the touched canonical artifacts.
