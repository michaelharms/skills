# Structure: where code lives

Read this when creating, moving or renaming files, adding a module, or when you're unsure where something belongs.

## Contents

- Top-level layout
- Module layout
- Only what's needed
- Adding a new module
- Flat folders and imports
- Naming and exports
- Where does it go?

## Top-level layout

```
e2e/                   End-to-end tests, outside src/
src/
  app/                 Routing only (page, layout, loading, error, not-found, route handlers, metadata)
  components/
    patterns/          Reusable composites with no domain knowledge (data-table, empty-state, confirm-dialog)
    primitives/        Building blocks (button, dialog, input), e.g. from shadcn/ui. Domain-agnostic.
    shells/            App chrome rendered by layout.tsx (app-shell, sidebar, auth-shell)
  db/                  Drizzle client, schema (tables + relations), migrations
  lib/                 Domain-agnostic infrastructure (env, cn, AppContext type, errors/, logger/, analytics/ if used)
  modules/<domain>/    Domain model, use-cases, persistence and domain UI for one domain
  screens/             One component per page; what page.tsx renders
  server/              Delivery layer: tRPC and/or server actions, context, error mapping, observability
  instrumentation.ts   Next.js entry files: the only files directly in src/
  proxy.ts
```

Trees in this skill are sorted the way an editor's file explorer shows them: folders first, then files, each alphabetically.

Everything under `src/` must belong to one of these layers. The lint config fails on files elsewhere, because a new top-level location changes the architecture and deserves a deliberate decision (an ADR, see `planning.md`) rather than a side effect of one change.

## Module layout

A module is a vertical slice for one domain. Name the folder with the plural noun (`tasks`); entity files use the singular (`task.ts`).

This is every part a module can have, not what each module must have (see "Only what's needed"):

```
modules/tasks/
  components/          Domain UI (task-card.tsx, task-form.tsx)
  domain/              Entities, value objects, invariants, transitions, policies    [client-safe, pure]
    task.fixtures.ts
    task.test.ts
    task.ts
  hooks/               Client hooks (use-task-filters.ts)
  persistence/         Drizzle queries + row ↔ entity mapping                        [server-only]
    task-repository.ts
  use-cases/           Application operations, one per file                         [server-only]
    complete-task.test.ts
    complete-task.ts
  utils/               Pure presentation helpers, one per file                       [client-safe]
  constants.ts         Limits, defaults                                              [client-safe]
  dtos.ts              Wire shapes + mappers for data crossing the network           [client-safe]
  error-messages.ts    User-facing message per error code                           [client-safe]
  errors.ts            Error classes with code + kind                                [client-safe]
  events.ts            Analytics event catalog (defineEvent), with analytics         [client-safe]
  schemas.ts           Zod input schemas, built from domain value objects            [client-safe]
  urls.ts              Typed href builders                                           [client-safe]
```

"Contract" means the module's root files (`schemas`, `dtos`, `errors`, `error-messages`, `events`, `constants`, `urls`): the client-safe surface other modules and the UI may use.

"Client-safe" files may be imported by client components, so they must not import server-only code, Drizzle or Node APIs. "Server-only" files start with `import "server-only"`, which makes the build fail if client code imports them.

## Only what's needed

Create a file or folder when it gets its first real content, never as a placeholder. An empty `hooks/` folder or an `urls.ts` with nothing in it tells the next reader nothing, suggests structure that isn't there, and has to be maintained anyway. When a module's last hook or URL goes away, delete the file or folder too.

| Create… | When… |
|---|---|
| `domain/`, `use-cases/`, `persistence/`, `schemas.ts` | The module has its first entity, operation, query or input |
| `errors.ts` and `error-messages.ts` (together) | The first module-specific error exists; common errors live in `lib/errors/` |
| `constants.ts` | A limit or default is shared by more than one of domain, schemas and UI |
| `dtos.ts` | Data crosses the network in a shape or types the transport can't carry as is (see `contracts.md`) |
| `urls.ts` | The module has its first page to link to |
| `events.ts` | The project has analytics and the first event of this module is worth tracking |
| `components/`, `hooks/`, `utils/` | The first component, client hook or presentation helper |
| A shared piece in `server/` or `lib/` | The first change that uses it (`route-handler.ts` with the first route handler) |

The same goes for infrastructure: a second transport, tracing, analytics, Storybook and other optional pieces are added when the project needs them (see `setup.md`).

## Adding a new module

Build it file by file as the first feature needs it:

1. `modules/<plural>/domain/<entity>.ts` with the entity, its value objects and its first rules (see `domain.md`).
2. `errors.ts` and `error-messages.ts` once the first error exists (see `error-handling.md`).
3. The Drizzle table in `src/db/schema/<plural>.ts` and `persistence/<entity>-repository.ts` (see `use-cases-and-persistence.md`).
4. The first use-case and its input schema in `schemas.ts`.
5. A router in `src/server/trpc/routers/<plural>.ts` merged in `root.ts`, or actions in `src/server/actions/<plural>.ts`, depending on the project's transport (see `delivery.md`).
6. In projects with analytics, `events.ts` when the first business event is worth tracking (see `observability.md`).
7. UI in `components/`, a screen in `src/screens/<area>/`, and a route in `src/app/` (see `ui-and-routing.md`).

## Flat folders and imports

There are no barrel files, no `index.ts` files and no folder per component. Each thing is one file, named after what it contains and placed directly in its layer folder, so an import path is short and says exactly what it loads:

```ts
import { TaskCard } from "@/modules/tasks/components/task-card";
import { completeTaskUseCase } from "@/modules/tasks/use-cases/complete-task";
import { Button } from "@/components/primitives/button";
```

Never `…/task-card/task-card` or `…/task-card/index`. Paths are at most `@/modules/<module>/<layer>/<file>`, and they omit the extension.

- **Layer folders are flat.** `domain/`, `use-cases/`, `persistence/`, `components/`, `hooks/` and `utils/` in a module, and each folder in `src/components/`, contain files, not subfolders. A component's test, story and private parts sit beside it as siblings with a shared prefix:

  ```
  modules/tasks/components/
    task-card-menu.tsx       private part of the card; same prefix, sorts next to it
    task-card.stories.tsx
    task-card.test.tsx
    task-card.tsx
  ```

- **A crowded layer folder means the module is too big.** When a module's `components/` or `use-cases/` gets hard to scan, split the module along a domain boundary (`tasks` → `tasks` + `task-boards`) rather than adding subfolders. Splitting keeps paths flat and makes the new boundary visible to lint.
- **Contract files may be promoted to a folder** when they grow past roughly 150 lines: `errors.ts` becomes `errors/task-errors.ts` plus `errors/comment-errors.ts`. Name the files inside after their content, never `index.ts`.
- **Relative imports only nearby.** Inside a module or folder, import relatively (`./task-card`, `../domain/task`). Across modules and layers, use the `@/` alias. `../../` is a lint error: an import that climbs two levels has left its module, and the alias says where it goes.
- **Why no barrels:** they hide which file depends on which (so lint can't check boundaries), create import cycles, pull unused code into client bundles, and slow down tests and type checking. Folder-per-file layouts exist mainly to make barrels look tidy; without barrels they only add a repeated segment to every path.

`src/app/` is the exception: Next.js requires a folder per route with fixed file names (`page.tsx`, `layout.tsx`), and those files are never imported.

## Naming and exports

- Files and folders: `kebab-case`. Components: `PascalCase` named exports.
- Named exports only, except where Next requires a default export (`page`, `layout`, `error`, …). No re-exports (`export … from`); lint rejects them.
- Name code after the project's domain glossary (`GLOSSARY.md`, if the project keeps one): the module is the plural of the glossary term, the entity file its singular, and events and error codes use the same term (`task.completed`, `task.not_found`). When planning introduces a new term, it goes into the glossary before it becomes a name in code.
- Use-cases: `<verb><Entity>UseCase` (`completeTaskUseCase`), so they don't clash with the domain function they wrap (`completeTask`).
- Server actions: `<verb><Entity>Action`. Action metadata names and tRPC paths: `<module>.<operation>` (`tasks.complete`).
- Tests, stories and fixtures share the base name of the file they cover: `task-card.test.tsx`, `task-card.stories.tsx`, `task.fixtures.ts`.

## Where does it go?

| You're writing… | Put it in |
|---|---|
| A new building block (a shadcn/ui component, if the project uses it) | `components/primitives/` |
| A table, dialog or empty state with no domain knowledge | `components/patterns/` |
| Sidebar, header, app frame | `components/shells/` |
| A card or form for one domain entity | `modules/<domain>/components/` |
| A client hook for one domain | `modules/<domain>/hooks/` |
| The body of a page | `screens/<area>/<name>-screen.tsx` |
| A value object, entity type, invariant or state transition | `modules/<domain>/domain/` |
| An operation that loads, changes or saves data | `modules/<domain>/use-cases/` |
| A Drizzle query or row ↔ entity mapping | `modules/<domain>/persistence/` |
| A Drizzle table or relation | `db/schema/<domain>.ts` |
| A tRPC procedure (projects with tRPC) | `server/trpc/routers/<domain>.ts` |
| A server action (projects with server actions) | `server/actions/<domain>.ts`, built from `authActionClient` or `actionClient` |
| The shape sent to the client and its (de)serialization | `modules/<domain>/dtos.ts` |
| A Zod schema used by both a form and a procedure | `modules/<domain>/schemas.ts` |
| A new error a user can trigger | Class in `modules/<domain>/errors.ts` + message in `modules/<domain>/error-messages.ts` |
| An auth, permission or rate-limit error | `lib/errors/common-errors.ts` |
| A business event for analytics (projects with analytics) | `modules/<domain>/events.ts`; emit it with `ctx.events.emit(...)` in the use-case |
| A debug log line | `ctx.logger.debug(...)` in the use-case, at the decision point |
| An href | `modules/<domain>/urls.ts` |
| A pure display or formatting helper for one domain | `modules/<domain>/utils/` |
| A helper with no domain knowledge | `lib/` |
| A new logging or analytics vendor (any provider) | A sink in `lib/logger/sinks/` or `lib/analytics/sinks/`, selected in `root-logger.ts` / `root-analytics.ts` |
| Mapping errors to HTTP or tRPC | Nowhere new: `server/errors.ts` (and `server/trpc/init.ts` with tRPC) already map by kind |
| A test, or a story (with Storybook) | Next to the file it covers |
| Test data builders | Next to the entity: `modules/<domain>/domain/<entity>.fixtures.ts` |
| An end-to-end test | `e2e/` at the project root |
