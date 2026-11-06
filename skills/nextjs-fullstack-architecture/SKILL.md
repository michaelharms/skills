---
name: nextjs-fullstack-architecture
description: Architecture rules for full-stack Next.js + TypeScript apps (App Router, Drizzle, Zod, Vercel, with tRPC and/or next-safe-action). Covers where files go, layers (domain, use-cases, persistence, delivery), domain modeling and invariants, error handling, logging and optional tracing and analytics, tests and stories, and lint-enforced import boundaries. Use it whenever you write, move, refactor or review code in such a project, add a feature, module, page, form, tRPC procedure, server action or API route, decide where something belongs, handle or display errors, add logs or analytics events, write Storybook stories, or decide where test, story or fixture files go, even if the user never mentions architecture. Also use it, alongside any planning tool, when interviewing about a feature or writing or reviewing specs, PRDs, tickets, implementation plans or ADRs for such a project, and to set these conventions up in a new or existing project.
license: MIT
---

# Next.js full-stack architecture

This skill holds the architecture rules for full-stack Next.js projects. The rules are split into reference files so that you load only what the current task needs: this file is the map, and the table under "Read only what the task needs" tells you which references to open.

**Project rules win.** If the project's `AGENTS.md` or `CLAUDE.md` lists deviations from this skill, follow the deviation and don't "fix" it. When a deviation contradicts something here, mention it once if it matters for the task, then go with the project.

Examples throughout use a `tasks` module (a to-do app). They illustrate the patterns; the project's own modules replace them.

## The map

```
src/
  app/                 Routing only: page, layout, loading, error, route handlers, metadata
  components/
    patterns/          Reusable composites with no domain knowledge
    primitives/        Building blocks (shadcn/ui, if used), domain-agnostic
    shells/            App chrome rendered by layout.tsx
  db/                  Drizzle client, tables, migrations
  lib/                 Domain-agnostic infrastructure: errors/, logger/, analytics/ (if used), AppContext type
  modules/<domain>/    Vertical slice per domain; each part exists only once it has content:
    components/          Domain UI
    domain/              Entities, value objects, invariants, transitions   (pure, client-safe)
    hooks/               Client hooks
    persistence/         Drizzle queries, row ↔ entity mapping              (server-only)
    use-cases/           Application operations                             (server-only)
    utils/               Presentation helpers
    constants.ts dtos.ts error-messages.ts errors.ts events.ts schemas.ts urls.ts   (contract, client-safe)
  screens/             One component per page; what page.tsx renders
  server/              Delivery: tRPC and/or server actions, context, error mapping, observability
  instrumentation.ts   Next's onRequestError, and tracing setup if used
```

Dependencies point inward:

```
app → screens → module components/hooks
server (tRPC, actions) → use-cases → domain ← persistence → db
```

## Rules that apply to every change

These hold no matter which part of the code you touch. Each exists so that code stays easy to find, change and reuse; the references explain the details.

1. **Put files where `references/structure.md` says.** Don't invent folders: lint fails on files outside the known layers, and an unknown location is a decision for an ADR, not for a single change. Layer folders are flat and there are no barrels, so imports name the file directly: `@/modules/tasks/components/task-card`.
2. **Build only what's needed now.** Create a file or folder with its first real content, never as an empty placeholder: a module gets `urls.ts` with its first page, `errors.ts` with its first error. Use only the optional pieces the project has set up (its transport, tracing, analytics, Storybook; see the "Setup" list in its `AGENTS.md`, or `package.json`), and don't add one as a side effect of a feature.
3. **Business rules live in `domain/`**, as pure functions over readonly data. Keeping them free of I/O and frameworks makes them testable without mocks and reusable on the client.
4. **Use-cases get everything through `ctx`** (db, user, clock, logger, and events with analytics) and never call `headers()`, `cookies()`, `auth()` or `new Date()`. That's what lets the same use-case run from tRPC, a server action, a cron job or a test.
5. **Only `persistence/` and `db/` touch Drizzle.** Storage is an infrastructure detail; the domain model doesn't change when tables do.
6. **Procedures and actions are thin**: validate input → call one use-case → map to a DTO if the module has one. No business logic, no `try/catch`, no logging; middleware does that once for every operation.
7. **Errors are `AppError` subclasses with a code and a kind.** Never throw `TRPCError`, `Response` or status codes outside `src/server/`; the kind decides the status, so new errors need no mapping code.
8. **Log with `ctx.logger`, and emit analytics with `ctx.events` if the project has analytics.** Never `console` or a vendor SDK outside its sink, so vendors stay swappable and redaction can't be bypassed.
9. **Tests, stories and fixtures sit next to the file they cover**, with the same base name. With Storybook, components and screens get a story per visual state. Beyond placement, how to test follows the project's testing guidelines.
10. **Lint is the enforcer.** Fix a boundary violation by moving code to the right layer, never by disabling the rule or widening the config.

## Read only what the task needs

Open the references for the task at hand, not all of them. Longer references start with a table of contents; read the sections you need.

| When you are… | Read |
|---|---|
| Creating, moving or renaming files, adding a module, unsure where something belongs | `references/structure.md` |
| Building a page, layout, screen, component, form or link | `references/ui-and-routing.md` |
| Modeling entities, value objects, business rules, validation that types can't express, state changes | `references/domain.md` |
| Writing an operation that loads or saves data, a query, a transaction, a table or migration | `references/use-cases-and-persistence.md` |
| Writing input schemas, DTOs or constants | `references/contracts.md` |
| Adding a tRPC procedure, server action, route handler, or touching auth/context; choosing a transport | `references/delivery.md` |
| Throwing, mapping or displaying errors | `references/error-handling.md` |
| Adding logs, analytics events or tracing, or debugging a production issue | `references/observability.md` |
| Placing test, story or fixture files | `references/test-files.md` |
| Writing or reviewing Storybook stories, or adding a visual state to a component | `references/stories.md` |
| Fixing a bug | "Debugging a reported error" in `references/observability.md`, then the reference for the faulty layer |
| Fixing a lint boundary error or checking what may import what | `references/import-rules.md` |
| Reviewing code, a diff or a pull request, or updating `CODING_STANDARDS.md` | `references/review-checklist.md` (it links to the rest) |
| Interviewing about a feature, or writing or reviewing a spec or PRD, ticket, user story, implementation plan or ADR, with any tool or by hand | `references/planning.md` |
| Explaining or questioning why the architecture is this way | `references/decisions.md` |
| Setting this up in a new project, adopting it in an existing one, adding an optional piece (tRPC, server actions, tracing, analytics, Storybook), or building the shared infrastructure | `references/setup.md` |

A complete feature (for example "users can archive tasks") usually touches, in this order: domain → contracts and errors → use-cases and persistence → delivery → UI. Read the references as you reach each layer rather than all at once.

## Workflow for code changes

1. Work out which layers the change touches, using the map above.
2. Read the references for those layers.
3. Build from the inside out: domain first, then errors, events (with analytics) and schemas, then persistence and the use-case, then the procedure or action, then the UI. Create only the files the change fills. Put any tests next to the files they cover.
4. Run the project's lint, type check and tests. Treat boundary errors as design feedback.
5. Before finishing, check the touched layers against `references/review-checklist.md`.

## Assets

- `assets/agents-md-snippet.md`: the section a project adds to its `AGENTS.md` to point here, with its setup choices and deviations.
- `assets/eslint.boundaries.mjs`: the lint config that enforces layers, flat folders without barrels, vendor isolation and test colocation.
- `assets/templates/spec.md`, `assets/templates/issue.md`, `assets/templates/adr.md`: fallback templates when the project uses no planning tool.
- `assets/templates/adr-adopt-architecture.md`: the ADR that records a project's adoption of this architecture, so planning and review tools that read `docs/adr/` see its constraints.
- `assets/templates/coding-standards.md`: the project's `CODING_STANDARDS.md`, the judgement calls lint can't enforce, for review tools that read standards files.
