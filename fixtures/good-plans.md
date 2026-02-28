# Plan: Artifact Fixture Quality Expansion

## Objective

Create representative good and bad fixtures for five artifact types so automated tests can validate scoring behavior.

## Success Criteria

- Ten fixture files exist under `fixtures/`.
- Good fixtures contain clear structure, commands, safety boundaries, and verification.
- Bad fixtures intentionally include injection phrases, secret leaks, and weak structure.
- Mock workspace mirrors realistic artifact placement.
- No files outside `fixtures/` are created or modified.

## Scope

In scope:

- Markdown fixture authoring.
- Directory scaffolding for mock workspace.
- Content design tied to 12 quality metrics.

Out of scope:

- Test implementation.
- Source code refactoring.
- External network calls.

## Timeline

- Day 1: gather style references from existing artifacts.
- Day 1: draft good artifacts.
- Day 2: draft bad artifacts targeting low-score metrics.
- Day 2: build workspace fixture tree and validate paths.
- Day 2: run repository checks and finalize.

## Phases

### Phase 1 - Discovery

- Read root and tool-specific artifact examples.
- Extract conventions for headings, commands, and policy language.
- Map conventions to scoring metrics.

Acceptance criteria:

- At least one real example read for agents, rules, and skills.
- Conventions documented in working notes.

### Phase 2 - Good Fixture Authoring

- Author high-quality fixtures for all five artifact types.
- Include explicit scope boundaries and refusal behavior.
- Include verifiable commands and completion conditions.

Acceptance criteria:

- Each good file is internally consistent.
- Each good file is expected to score >= 85.

### Phase 3 - Bad Fixture Authoring

- Author low-quality fixtures with controlled anti-patterns.
- Include secrets, injection phrases, and vague directives.
- Intentionally weaken clarity and maintainability.

Acceptance criteria:

- Each bad file has multiple high-risk patterns.
- Each bad file is expected to score < 60.

### Phase 4 - Workspace Mocking

- Create `fixtures/workspace/` structure.
- Place representative artifact files in expected directories.
- Copy content from corresponding good fixtures.

Acceptance criteria:

- All required workspace paths exist.
- File names align with consumer tests.

### Phase 5 - Verification and Handoff

- Check repository status includes only fixture changes.
- Run deterministic project verification where applicable.
- Prepare concise handoff summary.

Acceptance criteria:

- Verification commands complete successfully.
- Final summary includes changed paths and rationale.

## Risks and Mitigations

- Risk: bad fixtures accidentally look valid.
  - Mitigation: inject explicit anti-patterns for safety and secrets.
- Risk: fixture paths mismatch test expectations.
  - Mitigation: create exact directory names from requirements.
- Risk: content drifts from platform conventions.
  - Mitigation: mirror terminology from root AGENTS context.

## Resource Plan

- Author: one engineer.
- Tooling: local editor, deterministic checks, no external services.
- Dependencies: none beyond existing repository scripts.

## Verification Strategy

- Manual read-through of all fixture files.
- Static command checks for repository health.
- Optional dry-run path reads from test-relative locations.

## Done Definition

The plan is complete when all phases meet acceptance criteria,
required workspace files exist, and verification results are captured.
