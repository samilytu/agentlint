# Test Guide

This guide applies to all files under `tests/`.

## Test layout

- `tests/unit/`: pure unit tests for deterministic logic.
- `tests/integration/`: multi-module behavior and API contracts.
- `tests/e2e/`: browser-level flows.

## Rules

- Keep tests deterministic and isolated.
- Mock network/provider dependencies when possible.
- Assert behavior and contracts, not implementation trivia.
- Add tests with each behavior change in app, server, or MCP flows.
- Keep fixtures minimal and local to the test scope.

## Stability

- Avoid timing-sensitive assertions unless required.
- Prefer explicit setup/teardown and environment stubbing.
