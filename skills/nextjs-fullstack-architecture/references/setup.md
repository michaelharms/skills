# Setting up a project

Read this when setting up these conventions in a new project or adopting them in an existing one, when adding an optional piece, or when a change needs a shared piece (errors, logger, context, transport, …) the project doesn't have yet.

## Contents

- Setup workflow
- Choose what the project needs
- Configuration
- Point the project's AGENTS.md here
- Building shared pieces on first use
  - Adding shadcn/ui
- Dependencies
- Environment variables
- Adopting in an existing project

Set up only what the project needs now (D23 in `decisions.md`). Setup records the project's choices and installs the guardrails (lint, `AGENTS.md`, ADR, standards); it writes no infrastructure code. Each shared piece is built by the first change that needs it, with its first real content: no empty placeholders.

## Setup workflow

When asked to set up this architecture, follow these steps in order.

1. **Detect the starting point.** An empty folder: continue with every step. A fresh Next app (only the files `create-next-app` generates): skip step 3. An existing app with code of its own: follow "Adopting in an existing project" instead; setup there moves, rewrites or deletes no existing code.
2. **Ask the user** about each optional piece in "Choose what the project needs", in one round of questions with its default, unless the request already answered it. Don't guess. If you can't ask, use the defaults, record the transport as undecided (it has no default), and list these as assumptions in the report.
3. **Scaffold**, if there's no app: `npx create-next-app@latest . --ts --eslint --app --src-dir --import-alias "@/*" --yes`. Check `node --version` first against the minimum in Next's docs (Node 20.9 for Next 16); with an older Node the scaffold fails. Run every init command non-interactively.
4. **Install only what the configuration needs now:** `npm i -D eslint-plugin-boundaries eslint-import-resolver-typescript`. Runtime libraries (Zod, Drizzle, tRPC, `next-safe-action`, OpenTelemetry, analytics SDKs, pino) are installed by the change that first imports them (see "Dependencies"). Storybook is the exception, because its init command is setup: run it now if chosen. shadcn/ui, even if chosen, is set up with the first primitive taken from it (see "Adding shadcn/ui").
5. **Configure** the project as in "Configuration".
6. **Point the project's agents here**, as in "Point the project's AGENTS.md here", with the "Setup" list filled in from the answers.
7. **Verify**: `npx eslint .`, `npx next typegen && npx tsc --noEmit` (the route types `tsc` needs come from `typegen`) and `npx next build` all pass. In a new project the boundary rules are at `"error"`; in an existing one, lint passes with warnings only (see "Adopting in an existing project").
8. **Report** what was set up and what was chosen, that shared pieces are built by the first feature that needs them, and what only the user can do later: create the Postgres database and set `DATABASE_URL` once the first table exists, and add vendor keys once tracing or an analytics provider is built. Leave the changes uncommitted for the user to review, unless asked to commit.

## Choose what the project needs

| Piece | Choose it when | Default | If not chosen |
|---|---|---|---|
| **Core** (always) | Next.js, Zod, Drizzle, errors, logging, request context, lint boundaries | — | — |
| **tRPC** | Client components fetch and cache data (refetching lists, optimistic updates) | Ask: there is no default transport | No `server/trpc/`, no TanStack Query |
| **Server actions** (`next-safe-action`) | Mutations come from forms, or end in a redirect or revalidation | Ask, together with tRPC | No `server/actions/` |
| **Tracing** (OpenTelemetry) | You need to see which steps a request ran and how long each took | No | No spans, no `traceId` in logs; `instrumentation.ts` holds only `onRequestError` |
| **Analytics** | The product needs business events | No | No `lib/analytics/`, no `ctx.events`, no `events.ts` in modules |
| **Analytics provider** (PostHog, Segment, …) | Events should leave the logs and reach an analytics tool | None | Events go only to the logs |
| **Logging library** (pino, …) | The console sink's JSON lines on stdout aren't enough | Console sink | The console sink, with no dependency |
| **Storybook** | Components' visual states should be built and reviewed in isolation | No | No stories; `stories.md` doesn't apply |
| **shadcn/ui** | You want its primitives. It can be added at any time, with the first primitive taken from it | No | `components/primitives/` holds your own building blocks |

Most projects need at least one of tRPC and server actions; `delivery.md` ("Choosing the transport") helps decide, so ask what the app does rather than which library the user prefers. A transport left undecided at setup is decided before the first procedure or action: ask then, and record the answer. Record the choices in the "Setup" list of the project's `AGENTS.md` (see `assets/agents-md-snippet.md`), so agents know what the project uses and don't add the rest on their own. Adding a piece later is a decision too: ask the user rather than adding it as a side effect of a feature, update the list, and write an ADR when it brings a vendor or a second transport (see "ADRs" in `planning.md`). shadcn/ui needs no ADR: its components are copied into the project and become the project's own code.

## Configuration

**`eslint.config.mjs`**: copy `assets/eslint.boundaries.mjs` to the project root. Then edit the generated `eslint.config.mjs` rather than replacing it: import the boundaries config and spread it after the Next config, which provides the TypeScript parser, keeping everything else. The result:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundariesConfig from "./eslint.boundaries.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundariesConfig,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

A project not scaffolded with `create-next-app` also needs `eslint`, `eslint-config-next` and `typescript` as dev dependencies.

**`tsconfig.json`**: the `@/*` alias resolves to `src/*` (`"paths": { "@/*": ["./src/*"] }`; `create-next-app` sets it with the flags above). The lint resolver reads it.

**`next.config.ts`**: add `typedRoutes: true`, and keep the options `create-next-app` generated.

**Storybook**, if chosen: `npm create storybook@latest -- --yes`, then delete the example stories it generates (`src/stories/`), because lint rejects that folder; stories sit next to their components (see `stories.md`).

## Point the project's AGENTS.md here

1. Add the section from `assets/agents-md-snippet.md` to whichever of `CLAUDE.md` / `AGENTS.md` the project uses (never create both; `create-next-app` generates an `AGENTS.md`, so add it below Next's own block there), and fill in its "Setup" list. It's a few navigation pointers, the setup choices and the list of deviations; deviations listed there win over this skill, so record every one with a link to its ADR. Keep it short and next to any other tools' sections: these files load into every agent's context.
2. Copy `assets/templates/adr-adopt-architecture.md` to `docs/adr/0001-follow-nextjs-fullstack-architecture.md` (or the next free number), and delete the "Save as" comment at its end. Tools that read ADRs but not this skill (spec and ticket writers, architecture reviews) then know the constraints and won't propose undoing deliberate choices.
3. Copy `assets/templates/coding-standards.md` to `CODING_STANDARDS.md` at the repo root. Review tools that look for standards files read it; it holds the judgement calls lint can't enforce.
4. Start `GLOSSARY.md` (the domain glossary) when the first domain term needs defining; module and entity names follow it. If the project already keeps a glossary under another name, use that.

## Building shared pieces on first use

When a change needs a shared piece the project doesn't have yet, build it first, in the same change, with its dependencies and environment variables (add each variable to `.env.example`). Build each to the behavior its reference describes; the code examples there show the public shapes (`AppError`, message catalogs, procedures, actions, use-cases). Build only the parts for pieces the project uses: without analytics, `AppContext` has no `events` and `observe()` releases no events; without tracing, `observe()` opens no span. When an optional piece is added later, extend the pieces that already exist (see "Adding tracing" and "Adding analytics" in `observability.md`).

| Piece | Path | Build it when | Behavior described in |
|---|---|---|---|
| `AppError`, common errors, `ErrorPayload` | `lib/errors/app-error.ts`, `lib/errors/common-errors.ts` | The first error is thrown, or the first operation runs through `observe()` | `error-handling.md` ("Error classes", "Choosing the kind") |
| Client-side messages: `getErrorMessage`, `getFieldErrors`, `getErrorReference`, `ErrorMessages` type | `lib/errors/error-messages.ts` | The UI first shows an error, or a module gets its first `error-messages.ts` | `error-handling.md` ("Messages on the client") |
| Drizzle client | `db/client.ts` | The first table | `use-cases-and-persistence.md` |
| `AppContext` type | `lib/app-context.ts` | The first use-case | `use-cases-and-persistence.md` |
| Logger with redaction, error serialization and per-request debug buffer; console and memory sinks | `lib/logger/` | The first use-case (it logs through `ctx.logger`) | `observability.md` |
| `createRequestContext()` | `server/context.ts` | The first use-case is called (by a procedure, an action, a server component, a test or a script) | `delivery.md`, `observability.md` |
| `getCurrentUser()` around the project's auth library | `server/auth.ts` | The project gets auth | `delivery.md` ("Request context and auth") |
| `toErrorPayload()`, `describeError()`, `httpStatusByKind` | `server/errors.ts` | The first procedure, action or route handler | `error-handling.md` ("Who throws and who catches") |
| `observe()`: outcome line, debug flush | `server/observability.ts` | The first procedure, action or route handler | `observability.md` ("What happens automatically") |
| `onRequestError` | `instrumentation.ts` | The logger exists | `observability.md` |
| `handleRscError()` | `server/rsc-errors.ts` | A server component first calls a use-case | `delivery.md` ("Server components") |
| tRPC init: observability and error middleware, error formatter, `publicProcedure`, `protectedProcedure` | `server/trpc/init.ts`, `server/trpc/root.ts`, `app/api/trpc/[trpc]/route.ts` | The first tRPC procedure | `delivery.md`, `error-handling.md` ("Transports") |
| tRPC React client | `server/trpc/react.tsx` | A client component first calls a procedure | tRPC's TanStack Query integration docs, typed with `AppRouter` |
| `actionClient`, `authActionClient` | `server/actions/client.ts` | The first server action | `delivery.md` ("Server actions") |
| `defineRouteHandler()` | `server/route-handler.ts` | The first route handler | `delivery.md` ("Route handlers") |
| `registerOTel()`, spans in `observe()`, trace IDs in logs, query events in the Drizzle client | `instrumentation.ts`, `server/observability.ts`, `lib/logger/`, `db/client.ts` | With tracing: `observe()` is built, or tracing is added to a project that has it | `observability.md` ("Adding tracing") |
| `defineEvent`, event buffer, memory sink, `events` in `AppContext`, event release in `observe()` | `lib/analytics/`, `lib/app-context.ts`, `server/context.ts`, `server/observability.ts` | With analytics: the first business event worth tracking | `observability.md` ("Adding analytics", "Event catalog") |
| A sink per provider | `lib/analytics/sinks/` | With an analytics provider: once events exist | `observability.md` ("Analytics providers") |
| shadcn/ui: `components.json`, theme variables in `app/globals.css`, its dependencies | `components.json`, `app/globals.css`, `components/primitives/` | With shadcn/ui: the first primitive taken from it, whether it was chosen at setup or added later | "Adding shadcn/ui" below, `ui-and-routing.md` |

The first module is built layer by layer in the same way (see "Adding a new module" in `structure.md`).

### Adding shadcn/ui

Set it up in the change that needs its first primitive, in a new project or one that has run for months on its own primitives:

1. It needs Tailwind CSS, which `create-next-app` sets up by default. In a project without Tailwind, adding it is a decision of its own: ask first.
2. Run `npx shadcn@latest init --defaults --yes`. It writes `components.json`, adds theme variables to `app/globals.css` and installs its dependencies. Write no `components.json` beforehand: `init` then stops to ask whether to overwrite it.
3. Point its aliases in `components.json` into the layers, because its defaults (`@/components/ui`, `@/hooks`, `@/components`) are folders lint rejects: `ui` and `hooks` to `@/components/primitives` (its hooks only serve its primitives), `components` to `@/components/patterns` (its blocks are domain-agnostic composites). Keep `utils` and `lib`.
4. Move what `init` generated into `components/ui/` to `components/primitives/`, delete `components/ui/`, and keep only what the change uses (`init` adds a button whether it's needed or not). If it generated a `lib/utils.ts` that only re-exports `cn`, delete it: lint rejects re-exports, and the primitives import `cn` themselves. If the file defines `cn`, keep it.
5. Add components with `npx shadcn@latest add <component> --yes`; they now land in `components/primitives/` and import each other from there. Don't pass `--overwrite` where the project has its own primitive of the same name; replacing one is a change of its own.
6. Generated files pass lint like any other code: fix what lint reports instead of ignoring the folder (shadcn's `use-mobile` hook, for example, sets state in an effect; read it with `useSyncExternalStore` instead).
7. Set "shadcn/ui: yes" in the "Setup" list.

## Dependencies

Install each group in the change that first imports it:

```bash
# Zod: the first input schema
npm i zod

# server-only: the first server-only file (a use-case, persistence, server/)
npm i server-only

# Drizzle and the Postgres driver: the first table
npm i drizzle-orm pg
npm i -D drizzle-kit

# tRPC: the first procedure
npm i @trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query

# Server actions: the first action
npm i next-safe-action

# Tracing: @vercel/otel plus the OpenTelemetry versions its peerDependencies allow
npm i @vercel/otel
npm view @vercel/otel peerDependencies
npm i @opentelemetry/api@<allowed> @opentelemetry/api-logs@<allowed> @opentelemetry/sdk-logs@<allowed> \
  @opentelemetry/resources@<allowed> @opentelemetry/sdk-metrics@<allowed> \
  @opentelemetry/sdk-trace-base@<allowed> @opentelemetry/instrumentation@<allowed>

# Analytics provider: its server-side SDK, e.g. posthog-node (see "Analytics providers" in observability.md)

# Logging library, e.g.
npm i pino
```

Use the Postgres driver the project needs (`pg`, `@neondatabase/serverless`, …); only `src/db/client.ts` changes. For tracing, the newest OpenTelemetry packages often conflict with `@vercel/otel`'s peer ranges, so pick versions from its `peerDependencies` (at the time of writing: API 1.9.x, SDK 2.x, experimental packages 0.2xx).

## Environment variables

Add each variable to `.env.example` in the change that builds the piece reading it:

| Variable | Read by | Purpose |
|---|---|---|
| `DATABASE_URL` | Drizzle client | Postgres connection |
| `LOG_LEVEL` | Logger | `debug`/`info`/`warn`/`error`; default `info` in production, `debug` locally |
| `OTEL_SERVICE_NAME` | Tracing | Service name on traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | Tracing | Where traces go (or use a Vercel integration) |
| The provider's variables (e.g. `POSTHOG_API_KEY`, `POSTHOG_HOST`) | Analytics provider sink | Without them, events go to the memory sink |

On Vercel, add a log drain if logs should go somewhere besides Vercel's runtime logs.

## Adopting in an existing project

The architecture is adopted incrementally and never needs a big-bang refactor. Old and new structure live side by side for as long as it takes, and the project keeps working and shipping throughout; a repo-wide restructuring stalls feature work and produces a diff nobody can review.

1. **Setup changes configuration and docs only.** Ask about the pieces (an existing project often has some already: record those as chosen), install the lint dependencies, configure lint, point the project's agents here and verify (steps 2 and 4–8 of the setup workflow, with lint passing on warnings as below). Don't move, rewrite or delete existing code; list what isn't migrated yet in the report instead of migrating it. Turn on `typedRoutes` only if the type check still passes with it; existing string `href`s can fail it, so otherwise leave it off and list it in the report as part of the migration.
2. **Lint starts as warnings.** Downgrade the architecture rules in a block after the boundaries config, so CI stays green. A severity alone keeps each rule's options and messages; the block needs the same `files` as the boundaries config, which registers the plugin:

   ```js
   {
     // Until every module is migrated (see Deviations in AGENTS.md).
     files: ["src/**/*.{ts,tsx}"],
     rules: {
       "boundaries/dependencies": "warn",
       "boundaries/no-unknown-files": "warn",
       "boundaries/no-unknown-dependencies": "warn",
       "no-restricted-imports": "warn",
       "no-restricted-syntax": "warn",
       "no-console": "warn",
     },
   },
   ```

   Warnings in new or migrated code are still bugs: fix them in the same change.
3. **Record the legacy code as a temporary deviation** in `AGENTS.md`, naming where it lives: "Code in `src/components/legacy/` and `src/utils/` predates the architecture and is exempt until migrated. Don't copy its patterns, and don't migrate it unless the task changes it." Agents then follow the rules in new code without "fixing" untouched code on their own. The deviation's ADR is the adoption ADR: add a short "Migration" section to `docs/adr/0001-follow-nextjs-fullstack-architecture.md` saying the project migrates incrementally, which code is exempt until then, and that lint runs as warnings until migration is done, and link the deviation to it.
4. **Migrate as part of feature work.** New code goes through the new structure from day one, building the shared pieces it needs (see "Building shared pieces on first use"). A module is migrated when a feature changes it, starting with the modules that change most: domain first (entities and rules out of components and routes), then use-cases and persistence, then delivery and UI. Each migration is its own reviewable change.
5. **Finish when the warnings are gone.** A module counts as migrated when it lints without warnings. When all of them do, remove the override, the deviation and the ADR's "Migration" section, so the rules are errors again.

If the app has no `src/` folder, or its `@/*` alias points somewhere else, the lint config matches nothing yet. Say so in the report and propose moving the app into `src/` as the first migration: one mechanical change (`git mv` plus the alias), done only once the user agrees.
