# Source Code Guide

This guide applies to `src/` except directories with their own `AGENTS.md`.

## Layer boundaries

- `src/app/`: App Router pages, layouts, and route handlers.
- `src/components/`: UI components only; no database access.
- `src/server/`: server-only logic, APIs, services, and database access.
- `src/lib/`: shared utilities and schemas used across layers.
- `src/trpc/`: client bindings and query client setup.

## Rules

- Prefer server components; use client components only for interactivity.
- Keep strict typing; no `any`.
- Route mutations through tRPC procedures.
- Use Drizzle in server-side modules only.
- Keep file changes focused and avoid cross-layer shortcuts.

## Implementation notes

- Reuse existing utility and schema modules before adding new abstractions.
- Keep page-level files thin; move reusable logic to `src/server/` or `src/lib/`.
- Add or update tests for behavior changes in `tests/unit` or `tests/integration`.
