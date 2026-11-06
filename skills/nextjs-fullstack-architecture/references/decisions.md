# Decisions and rationale

Read this when explaining or questioning why the architecture is the way it is, when an edge case isn't covered by the rules, or when writing an ADR that overrides one of these decisions. Reasoning from the "why" is how to handle situations the rules don't anticipate.

Each decision has an ID that ADRs can reference (`Overrides: D4`).

## Contents

- D1–D6: Structure and layers
- D7–D11: Domain and data
- D12–D15: Delivery and errors
- D16–D20: Observability
- D21–D22: Test files and stories
- D23: Growing a project

## Structure and layers

**D1. Modules are vertical slices by domain.** Code for one domain (rules, data access, UI) lives together, so a change to tasks touches `modules/tasks/` and not five layer folders. Cross-cutting UI without domain knowledge stays in `components/`. Trade-off: a module boundary must be chosen deliberately; if two modules constantly import each other's contracts, they may be one module.

**D2. `app/` is routing only; pages render screens.** Routing concerns (params, redirects, metadata, loading/error files) change for different reasons than page content. Screens are testable and storyable without the router.

**D3. Dependencies point inward, enforced by lint.** Domain ← use-cases ← delivery, with persistence on the side. Rules that are only written down erode under deadline pressure and under agents that don't read them; lint makes the architecture executable.

**D4. Persistence is plain functions, not repository interfaces.** Functions taking `db` keep Drizzle out of use-cases with no extra abstraction. Interfaces would only pay off with several storage implementations, which this kind of app doesn't have.

**D5. Use-cases receive everything through `ctx`.** No hidden request-scoped globals, so the same use-case runs from any transport, server components, cron and tests. Trade-off: one more parameter everywhere, accepted for explicitness.

**D6. No barrels, flat layer folders.** Barrels hide which file depends on which (breaking lint boundaries), create import cycles, pull unused code into client bundles and slow builds and tests. Without barrels, a folder per component only repeats its name in every path (`task-card/task-card`), so each thing is one file directly in its layer folder, with siblings sharing a prefix. Trade-off: a large module's folders get long; that's the signal to split the module, which keeps paths at most `@/modules/<module>/<layer>/<file>`.

## Domain and data

**D7. The domain model is independent of Drizzle.** Storage changes (columns, normalization, a different database) don't ripple into business rules, and the domain runs on the client. Cost: a mapping step in `persistence/`, kept cheap by rehydrating through the entity schema.

**D8. Entities are readonly plain data plus functions, not classes.** Plain data crosses server/client boundaries, works with Zod, spreads and structural equality, and needs no serialization layer. Cost: nothing stops hand-building an entity at the type level when it's fully consistent; the rule "construct only through domain functions" covers the gap.

**D9. Value objects are branded Zod schemas; entities are discriminated unions by state.** Illegal states don't compile, and the brand proves the runtime check ran. The same schemas validate forms, inputs and stored rows.

**D10. One choke point (`ensureValid`) checks invariants on every state change.** Rules the type system can't express (thresholds across fields) are still guaranteed after every transition, and rehydration uses the same schema, so corrupt rows fail at the boundary.

**D11. The domain decides but never fetches; concurrency rules also live in the database.** Passing facts in keeps the domain pure. Check-then-write in application code races, so limits and uniqueness are also enforced by constraints or locks.

## Delivery and errors

**D12. Each project chooses tRPC, server actions or both; all share one pipeline.** tRPC fits cached client data, actions fit forms and progressive enhancement, and many apps need only one. Whichever is used runs through the same context, error mapping and observability, so the choice doesn't change behavior, and use-cases don't depend on it, so adding the other later is cheap. Bare `"use server"` functions are not allowed because they'd bypass that pipeline.

**D13. Server actions, where used, go through `next-safe-action`.** It provides input validation, middleware, typed results and navigation handling (`redirect()` inside actions) without hand-written `try/catch` in every action.

**D14. Errors carry a code, a kind and safe details; the kind maps to the status.** New errors need no mapping code. Codes are a stable API for the client; kinds give sensible fallbacks; internal errors never expose details.

**D15. Messages live on the client, in typed per-module catalogs.** The server doesn't know the user's language or the UI context. `satisfies` makes catalogs exhaustive, and the fallback chain (code → common → kind → generic) means users always see something sensible.

## Observability

**D16. Logging happens at boundaries, not in business code.** One outcome line per operation from middleware gives consistent, queryable logs without clutter. Business code adds only debug lines at decision points and business events.

**D17. Debug lines are buffered per request and flushed only on internal errors.** Full detail for the requests that need debugging, almost no log volume for the rest.

**D18. Business events, where a project tracks them, are typed, buffered, and sent only on success, after the response.** Analytics never reports an operation that failed and never slows a request. The catalog is a contract with analysts.

**D19. Vendors sit behind sinks; OpenTelemetry's API is the tracing interface.** Logging and analytics libraries are swapped by adding a sink; no provider is assumed, and analytics works without one (events still reach the logs). OpenTelemetry's API is already vendor-neutral, so it isn't wrapped again; the backend is chosen by configuration. Redaction lives in the logger so a new sink can't lose it.

**D20. Every log line, span and internal error shares the request ID.** A user's error reference leads to the logs, the flushed debug lines and the trace of exactly that request.

## Test files and stories

**D21. Tests, stories and fixtures sit next to their files.** They're easy to find, they move and get deleted with their code, and lint can tell test code from production code by name. End-to-end tests are the exception because they cover routes, not files. How to test is deliberately not decided here, so this skill works with whatever testing guidelines a project follows.

**D22. In projects with Storybook, every component and screen has a story per visual state.** Empty, loading, error and variant states are where UI bugs hide, and they're hard to reach by clicking through the app. Stories built from fixtures and real error payloads make each state visible, reviewable and protected from regressions, and they show every user-facing error message.

## Growing a project

**D23. Only what's needed now: optional infrastructure and files are added when they get content.** Tracing, analytics, a logging library, Storybook, shadcn/ui and the second transport are set up when the project needs them, and module files (`urls.ts`, `errors.ts`, `dtos.ts`, `hooks/`, …) and shared files (`route-handler.ts`) are created with their first real content. Placeholders cost reading time, suggest structure that isn't there, and set up dependencies nobody uses. The layout in `structure.md` says where things go once they exist, not what must exist. Because use-cases get everything through `ctx` and vendors sit behind sinks, adding a piece later changes infrastructure files, not business code.
