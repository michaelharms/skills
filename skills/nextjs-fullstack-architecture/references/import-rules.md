# Import rules and lint boundaries

Read this when fixing a lint boundary error or checking what may import what. `eslint.boundaries.mjs` (from `assets/`) enforces everything below. When lint reports a violation, move the code to the right layer. Don't disable the rule or widen the config: a boundary error is design feedback, and widening the config changes the architecture for everyone.

## Contents

- Who may import what
- Also enforced
- Not enforced by lint
- Fixing common violations

## Who may import what

"Contract" means a module's root files (`schemas`, `dtos`, `errors`, `error-messages`, `events`, `constants`, `urls`).

| From | May import |
|---|---|
| `app/` | screens, shells, primitives, patterns, module contract/components/hooks, server, lib |
| `screens/` | everything except `db/` and a module's persistence |
| `components/shells` | shells, primitives, patterns, module contract/components, lib |
| `components/patterns` | patterns, primitives, lib |
| `components/primitives` | primitives, lib |
| module `components/` | primitives, patterns, any module's contract/components/domain, own hooks/utils, `server/trpc/react.tsx`, lib |
| module `hooks/` | any module's contract/domain, own hooks/utils, `server/trpc/react.tsx`, lib |
| module `utils/` | own domain/contract/utils, lib |
| module contract | any module's contract, own domain, lib |
| module `domain/` | any module's domain, own `errors` and `constants` |
| module `use-cases/` | any module's contract/domain/use-cases, own persistence, lib |
| module `persistence/` | any module's domain, own contract/persistence, db, lib |
| `server/` | server, module contract, use-cases, db, lib |
| `db/` | db, lib |
| `lib/` | lib (plus type-only imports of domain value objects for `AppContext`) |
| `proxy.ts`, `instrumentation.ts` | server, lib, module contract |

## Also enforced

- Type-only imports of `server/` and `db/` (for example `AppRouter`, `Db`) are allowed outside the pure layers (domain, contract, utils, primitives, patterns).
- Drizzle may only be imported in `db/` and `modules/*/persistence/`.
- Logging, tracing and analytics libraries (pino, `@vercel/otel`, OpenTelemetry SDKs, Sentry, analytics SDKs such as PostHog or Segment, …) may only be imported in `lib/logger/sinks/`, `lib/analytics/sinks/` and `src/instrumentation.ts`.
- `console` is an error everywhere in `src/` except the console sink, tests and `error.tsx` boundaries.
- Module files outside `components/` and `hooks/` may not import React, `next/*`, `@trpc/*` or `next-safe-action`. The domain additionally may not import `server-only` or OpenTelemetry.
- Every file under `src/` must belong to a known layer, so new top-level folders fail lint.
- Tests, stories and fixtures may import anything. Production code may not import them.
- Files inside `__tests__/`, `__stories__/`, `__mocks__/`, `tests/` or `stories/` folders under `src/` fail lint.
- No barrels: `index.ts(x)` files and re-exports (`export * from`, `export { x } from`) fail lint.
- Layer folders are flat: files in subfolders of a module's `domain/`, `use-cases/`, `persistence/`, `components/`, `hooks/` or `utils/`, or of a `src/components/*` folder, fail lint.
- Relative imports may climb at most one level (`../x`); `../../` fails lint. Use the `@/` alias across modules and layers.

## Not enforced by lint

The build catches these instead: client components (`"use client"`) must not import `use-cases/`, `persistence/`, `server/` (except `trpc/react.tsx` and types) or `db/`. Files in those layers start with `import "server-only"`, so a violation fails the build. Keep that import at the top of every use-case, persistence and server file.

Lint also can't see these; reviews must:

- Business rules outside `domain/` (an `if` on entity state in a use-case, router or component).
- Entities constructed by hand instead of through domain functions.
- Personal data in event properties or log fields not caught by the redaction pattern.
- Several use-cases called from one procedure or action (orchestration belongs in a use-case).

## Fixing common violations

| Lint says | Usually means | Fix |
|---|---|---|
| `domain may not import lib` | A domain file wants a generic helper | Inline it if tiny; otherwise the helper is domain logic and belongs in `domain/` |
| `domain may not import module` (not errors/constants) | Domain imports `schemas.ts` or `dtos.ts` | Reverse it: schemas and DTOs build on domain value objects, not the other way round |
| `module-ui may not import use-case` | A component calls server code | Go through the project's transport: a tRPC hook (`server/trpc/react.tsx`) or a server action |
| `use-case may not import db` / Drizzle restricted | Query written in a use-case | Move it into the module's `persistence/` and call that |
| `server may not import persistence` / `domain` | Router reads data or applies a rule itself | Call a use-case; map the result with the module's DTO mapper |
| `pattern may not import module` | A "generic" component knows about a domain | Move it to `modules/<domain>/components/`, or pass the domain bits in as props |
| `use-case may not import persistence` of another module | Cross-module data access | Call the other module's use-case instead |
| Vendor import restricted (pino, an analytics SDK, …) | Vendor SDK used directly | Use `ctx.logger` (and `ctx.events` with analytics); add a sink if a new vendor is needed |
| `no-console` | Debug print | `ctx.logger.debug(...)` with a dot-namespaced name and fields |
| `no-unknown-files` | File outside the known layers | Move it per `structure.md`; a genuinely new layer needs an ADR and a config change |
| `Tests and stories live next to the file they cover` | Test in a `__tests__/` folder | Move it next to the file, with the same base name |
| `Production code may not import tests, stories or fixtures` | App code uses a fixture | Fixtures are test-only; build real data through domain functions |
| `No index files` / `No barrels or re-exports` | A barrel or folder-per-file layout | Delete the index or re-export; import each thing from the file that defines it |
| `Layer folders are flat` | A component or use-case got its own folder | Move the files up into the layer folder with a shared prefix (`task-card.tsx`, `task-card-menu.tsx`); if the folder is crowded, split the module |
| `Use relative imports only inside a module or folder` | `../../` import | Import with `@/…` |
