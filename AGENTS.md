# Agent Lint - Project Context

## Purpose
Agent Lint evaluates and improves AI coding agent context artifacts:
- Skills
- AGENTS.md / CLAUDE.md
- Rules
- Workflows
- Plans

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS v4 + Shadcn UI
- tRPC + React Query
- Drizzle ORM + SQLite (libSQL compatible)

## Rules
- Prefer server components; use client components only for interactivity.
- Keep strict typing; no `any`.
- Use Drizzle for all data access.
- Route all mutations through tRPC procedures.
- Never auto-execute destructive commands.

## Judge Pipeline
1. Sanitize user input.
2. Select artifact-specific system prompt.
3. Run model provider (OpenAI/Anthropic) or fallback Mock Judge.
4. Validate export format (markdown/yaml safety checks).
5. Store original/refined content and score.

## Environment
See `.env.example` for required variables.
