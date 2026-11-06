# Coding standards

This project follows the `nextjs-fullstack-architecture` skill (https://github.com/michaelharms/skills/tree/main/skills/nextjs-fullstack-architecture). Its `references/` hold the detailed rules and their reasons; `docs/adr/` holds this project's decisions and deviations, which win over this file.

Layer boundaries, Drizzle and vendor isolation, flat folders without barrels, `console`, and test colocation are enforced by ESLint (`eslint.boundaries.mjs`). Don't review for those. This file holds the judgement calls lint can't check.

This project's setup (its transport, and whether it has tracing, analytics and Storybook) is listed under "Setup" in `AGENTS.md`/`CLAUDE.md`; apply the rules below only for the pieces it has.

## Deliberate patterns: don't flag these

- **Thin delivery adapters.** tRPC procedures, server actions and route handlers only validate input, call one use-case and map the result to a DTO where the module has one. That they mostly delegate is the point (one transport-agnostic use-case, one shared error and observability pipeline); it isn't a Middle Man.
- **Persistence functions without repository interfaces.** One implementation means no interface is needed.
- **Entity ↔ row and entity ↔ DTO mappings** repeat field lists on purpose: each is a boundary that changes for its own reasons. It isn't Duplicated Code.
- **Small error classes per failure** (`TaskNotFoundError extends AppError`) and a message catalog per module.
- **Branded value objects** (`TaskTitle`, `EstimateMinutes`) instead of raw strings and numbers.
- **Missing files and infrastructure.** A module without `urls.ts`, `dtos.ts` or `hooks/`, or a project without tracing, analytics or a second transport, isn't incomplete: files and pieces are added when they get content. Flag empty placeholders instead.

## Domain

- Business rules (any `if` about an entity's state, thresholds, cross-field rules) live in `domain/`, not in use-cases, routers or components.
- Entities are created and changed only through domain functions (factories, transitions named after the business action, rehydration), never built by hand, including in tests: fixtures call domain functions.
- A rule that needs data outside the entity takes it as a parameter; the domain never fetches. A rule that must hold under concurrency (uniqueness, limits) is also enforced by a database constraint or lock.

## Use-cases and persistence

- A use-case gets everything through `ctx` (db, user, clock, logger, and events with analytics) and never calls `headers()`, `cookies()`, `auth()` or `new Date()`.
- One use-case per file, starting with `import "server-only"`; it returns entities and throws `AppError` subclasses, never `TRPCError` or responses.
- A procedure or action calls exactly one use-case; orchestration of several belongs in a use-case.
- Persistence rehydrates rows through the domain and turns constraint violations into domain errors.

## Errors

- Error codes are namespaced and stable (`task.not_found`); renaming one breaks clients.
- The kind follows who has to act: `validation`, `forbidden`, `conflict` and the like for what the user can fix or must know; `internal` for bugs and corrupt data. Other users' resources are `not_found`.
- `details` contain only what the user may see. Every user-facing error has a message in its module's catalog.
- Errors are never caught just to log and rethrow; the boundary logs once.

## Observability

- Log calls use `ctx.logger` with a stable, dot-namespaced name and a fields object, never interpolated text. `debug` lines go at decision points in use-cases; domain, persistence and delivery don't log.
- With analytics, business events come from the module's catalog, are emitted after the state change succeeded, and contain no personal data (names, emails, free text).
- Logs never contain full entities, rows or request bodies.

## UI

- `page.tsx` parses params, handles not-found and redirects, and renders one screen; nothing else.
- Domain components live in their module; `components/patterns` and `components/primitives` know nothing about any domain.
- Links come from the module's `urls.ts`; `as Route` is never used.
- Client components reach the server only through the project's transport (tRPC hooks or server actions), and receive DTOs where the module has them.

## Names and stories

- Names of modules, entities, transitions, events and error codes use the terms in `GLOSSARY.md`, never its `_Avoid_` aliases.
- With Storybook, components and screens have a story for each visual state (empty, loading, error, each meaningful variant), fed by fixtures and real error payloads.
