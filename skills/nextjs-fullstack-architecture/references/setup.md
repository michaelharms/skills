# Setting up a project

Read this when starting a new project with these conventions or adopting them in an existing one.

## Contents

- Choose what the project needs
- Dependencies
- Build the shared infrastructure
- Configuration
- Point the project's AGENTS.md here
- Adopting in an existing project

Set up only what the project needs now. Optional pieces are added later, in the change that first needs them (D23 in `decisions.md`), and every file is created with its first real content: no empty placeholders.

## Choose what the project needs

| Piece | Choose it when | If not chosen |
|---|---|---|
| **Core** (always) | Next.js, Zod, Drizzle, errors, logging, request context, lint boundaries | — |
| **tRPC** | Client components fetch and cache data (refetching lists, optimistic updates) | No `server/trpc/`, no TanStack Query |
| **Server actions** (`next-safe-action`) | Mutations come from forms, or end in a redirect or revalidation | No `server/actions/` |
| **Tracing** (OpenTelemetry) | You need to see which steps a request ran and how long each took | No spans, no `traceId` in logs; `instrumentation.ts` holds only `onRequestError` |
| **Analytics** | The product needs business events | No `lib/analytics/`, no `ctx.events`, no `events.ts` in modules |
| **Analytics provider** (PostHog, Segment, …) | Events should leave the logs and reach an analytics tool | Events go only to the logs |
| **Logging library** (pino, …) | The console sink's JSON lines on stdout aren't enough | The console sink, with no dependency |
| **Storybook** | Components' visual states should be built and reviewed in isolation | No stories; `stories.md` doesn't apply |
| **shadcn/ui** | You want its primitives | `components/primitives/` holds your own building blocks |

Most projects need at least one of tRPC and server actions; `delivery.md` ("Choosing the transport") helps decide. Record the choices in the "Setup" list of the project's `AGENTS.md` (see `assets/agents-md-snippet.md`), so agents know what exists and don't add the rest on their own. Adding a piece later is a decision too: update the list, and write an ADR when it brings a vendor or a second transport (see "ADRs" in `planning.md`).

## Dependencies

Install the core, then only the groups for the pieces the project chose:

```bash
# Core
npm i next react react-dom zod server-only drizzle-orm pg
npm i -D typescript eslint typescript-eslint eslint-plugin-boundaries eslint-import-resolver-typescript drizzle-kit

# tRPC
npm i @trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query

# Server actions
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

# Storybook and shadcn/ui: their own init commands
npm create storybook@latest
npx shadcn@latest init
```

Use the Postgres driver the project needs (`pg`, `@neondatabase/serverless`, …); only `src/db/client.ts` changes. For tracing, the newest OpenTelemetry packages often conflict with `@vercel/otel`'s peer ranges, so pick versions from its `peerDependencies` (at the time of writing: API 1.9.x, SDK 2.x, experimental packages 0.2xx).

## Build the shared infrastructure

Build the core pieces before the first module, and each optional piece when it's chosen. Build each to the behavior its reference describes; the code examples there show the public shapes (`AppError`, message catalogs, procedures, actions, use-cases). Leave out what the project hasn't chosen, and the parts of a piece that serve it: without analytics, `AppContext` has no `events` and `observe()` releases no events; without tracing, `observe()` opens no span.

| Piece | Needed for | Path | Behavior described in |
|---|---|---|---|
| `AppContext` type | Core | `lib/app-context.ts` | `use-cases-and-persistence.md` |
| `AppError`, common errors, `ErrorPayload` | Core | `lib/errors/app-error.ts`, `lib/errors/common-errors.ts` | `error-handling.md` ("Error classes", "Choosing the kind") |
| Client-side messages: `getErrorMessage`, `getFieldErrors`, `getErrorReference`, `ErrorMessages` type | Core | `lib/errors/error-messages.ts` | `error-handling.md` ("Messages on the client") |
| Logger with redaction, error serialization and per-request debug buffer; console and memory sinks | Core | `lib/logger/` | `observability.md` |
| `getCurrentUser()` around the project's auth library | Core, once there is auth | `server/auth.ts` | `delivery.md` ("Request context and auth") |
| `createRequestContext()` | Core | `server/context.ts` | `delivery.md`, `observability.md` |
| `toErrorPayload()`, `describeError()`, `httpStatusByKind` | Core | `server/errors.ts` | `error-handling.md` ("Who throws and who catches") |
| `observe()`: outcome line, debug flush | Core | `server/observability.ts` | `observability.md` ("What happens automatically") |
| `handleRscError()` | Core, once a server component calls a use-case | `server/rsc-errors.ts` | `delivery.md` ("Server components") |
| `onRequestError` | Core | `instrumentation.ts` | `observability.md` |
| Drizzle client | Core | `db/client.ts` | `use-cases-and-persistence.md` |
| tRPC init: observability and error middleware, error formatter, `publicProcedure`, `protectedProcedure` | tRPC | `server/trpc/init.ts`, `server/trpc/root.ts`, `app/api/trpc/[trpc]/route.ts` | `delivery.md`, `error-handling.md` ("Transports") |
| tRPC React client | tRPC | `server/trpc/react.tsx` | tRPC's TanStack Query integration docs, typed with `AppRouter` |
| `actionClient`, `authActionClient` | Server actions | `server/actions/client.ts` | `delivery.md` ("Server actions") |
| `defineRouteHandler()` | The first route handler | `server/route-handler.ts` | `delivery.md` ("Route handlers") |
| `registerOTel()`, spans in `observe()`, trace IDs in logs, query events in the Drizzle client | Tracing | `instrumentation.ts`, `server/observability.ts`, `lib/logger/`, `db/client.ts` | `observability.md` ("Adding tracing") |
| `defineEvent`, event buffer, memory sink, `events` in `AppContext`, event release in `observe()` | Analytics | `lib/analytics/`, `lib/app-context.ts`, `server/context.ts`, `server/observability.ts` | `observability.md` ("Adding analytics", "Event catalog") |
| A sink per provider | Analytics provider | `lib/analytics/sinks/` | `observability.md` ("Analytics providers") |

Then copy `assets/eslint.boundaries.mjs` to the project root. Build the first module by following the references layer by layer (see "Adding a new module" in `structure.md`).

## Configuration

**`eslint.config.mjs`**: spread the boundaries config after the Next/TypeScript config, which provides the TypeScript parser:

```js
import { defineConfig } from "eslint/config";
import boundariesConfig from "./eslint.boundaries.mjs";

export default defineConfig([...nextConfig, ...boundariesConfig]);
```

**`tsconfig.json`**: the `@/*` alias resolves to `src/*` (`"paths": { "@/*": ["./src/*"] }`). The lint resolver reads it.

**`next.config.ts`**: `typedRoutes: true`.

**`components.json`** (with shadcn/ui): set the `ui` alias to `@/components/primitives`, so `shadcn add` writes there.

**Environment variables**:

| Variable | Needed for | Purpose |
|---|---|---|
| `DATABASE_URL` | Core | Postgres connection |
| `LOG_LEVEL` | Core | `debug`/`info`/`warn`/`error`; default `info` in production, `debug` locally |
| `OTEL_SERVICE_NAME` | Tracing | Service name on traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | Tracing | Where traces go (or use a Vercel integration) |
| The provider's variables (e.g. `POSTHOG_API_KEY`, `POSTHOG_HOST`) | Analytics provider | Without them, events go to the memory sink |

On Vercel, add a log drain if logs should go somewhere besides Vercel's runtime logs.

## Point the project's AGENTS.md here

1. Add the section from `assets/agents-md-snippet.md` to whichever of `CLAUDE.md` / `AGENTS.md` the project uses (never create both), and fill in its "Setup" list. It's a few navigation pointers, the setup choices and the list of deviations; deviations listed there win over this skill, so record every one with a link to its ADR. Keep it short and next to any other tools' sections: these files load into every agent's context.
2. Copy `assets/templates/adr-adopt-architecture.md` to `docs/adr/0001-follow-nextjs-fullstack-architecture.md` (or the next free number). Tools that read ADRs but not this skill (spec and ticket writers, architecture reviews) then know the constraints and won't propose undoing deliberate choices.
3. Copy `assets/templates/coding-standards.md` to `CODING_STANDARDS.md` at the repo root. Review tools that look for standards files read it; it holds the judgement calls lint can't enforce.
4. Start `GLOSSARY.md` (the domain glossary) when the first domain term needs defining; module and entity names follow it. If the project already keeps a glossary under another name, use that.

## Adopting in an existing project

Move incrementally; a big-bang restructuring stalls feature work and produces a huge, unreviewable diff.

1. Choose the pieces the project needs (see "Choose what the project needs"; an existing project often already has some of them), then add their dependencies, the shared infrastructure and the lint config. Set `boundaries/dependencies`, `boundaries/no-unknown-files` and `no-restricted-imports` to `"warn"` at first, so the build stays green.
2. Route all new code through the new structure from day one.
3. Migrate one module at a time, starting with the one changing most: domain first (entities and rules out of components and routes), then use-cases and persistence, then delivery and UI.
4. When a module is migrated, it must lint cleanly. When all are, switch the rules back to `"error"`.
5. Record temporary deviations in the project's `AGENTS.md` ("legacy code in `src/legacy/` is exempt until migrated") so agents don't copy old patterns.
