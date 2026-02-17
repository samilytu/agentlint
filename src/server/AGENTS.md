# Server Guide

This guide applies to `src/server/` except folders with their own `AGENTS.md`.

## Scope

- tRPC router/procedure implementation.
- Database access through Drizzle.
- Service-layer orchestration and security controls.

## Rules

- Keep server code deterministic and side effects explicit.
- Validate external input at boundaries (router or schema layer).
- Use Drizzle schema definitions from `src/server/db/schema.ts`.
- Avoid data access from UI modules; keep DB work in server modules.
- Reuse security helpers (for example, rate limiting) instead of duplicating logic.

## Structure

- `api/routers/`: endpoint-level procedure composition.
- `services/`: reusable domain logic shared by routers and MCP flows.
- `db/`: schema and db client wiring.
- `security/`: auth, validation, and rate-limit helpers.
