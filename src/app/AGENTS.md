# App Router Guide

This guide applies to `src/app/` and nested routes unless a deeper `AGENTS.md` overrides it.

## Scope

- Build UI and route composition for the Next.js App Router.
- Keep data and mutation logic in server modules.

## Rules

- Default to server components; add `"use client"` only when required.
- Keep `page.tsx` and `layout.tsx` focused on composition.
- Use `src/components/` for reusable UI.
- For API handlers under `src/app/api/`, delegate business logic to `src/server/`.
- Never expose secrets or server-only environment data to client components.

## Styling

- Use Tailwind and existing UI patterns from `src/components/ui/`.
- Preserve existing design tokens and utility conventions.
