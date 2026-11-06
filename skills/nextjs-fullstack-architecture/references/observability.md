# Observability: logs, traces and analytics events

Read this when adding logs or analytics events, touching tracing, or debugging a production issue.

Logging is part of every project. Tracing and analytics are optional: a project sets them up when it needs them, not up front. Check the project's `AGENTS.md` (its "Setup" list) or `package.json` to see which it uses, and never emit events or create spans in a project that doesn't use them.

## Contents

- Three signals
  - Adding tracing
  - Adding analytics
  - Analytics providers
- What happens automatically
- What you write
- Event catalog
- Redaction and data rules
- Debugging a reported error
- Vercel specifics

## Three signals

Each answers a different question and sits behind its own swap point:

| Signal | Answers | In the project | Code uses | Swap the vendor in |
|---|---|---|---|---|
| **Logs** | What happened in this request? | Always | `ctx.logger` (or `rootLogger` outside requests) | `src/lib/logger/root-logger.ts` picks a sink from `lib/logger/sinks/` |
| **Traces** | Which steps ran, in what order, how long did each take? | Once tracing is set up | Nothing; spans are created automatically | Environment variables (OTLP endpoint) or a Vercel integration; `src/instrumentation.ts` only registers OpenTelemetry |
| **Business events** | How is the product used? | Once analytics is set up | `ctx.events.emit(...)` with a module's event catalog | `src/lib/analytics/root-analytics.ts` picks a sink from `lib/analytics/sinks/` |

```
lib/analytics/         Only once the project tracks business events
  sinks/               memory-sink.ts (tests, and when no provider is configured), a sink per provider once one is chosen
  events.ts            defineEvent, EventRecorder, AnalyticsSink, per-request event buffer
  root-analytics.ts    Picks the sink by environment
lib/logger/
  sinks/               console-sink.ts (JSON lines in production, readable locally; no dependency), memory-sink.ts (tests)
  logger.ts            Logger interface, createLogger, createRequestLogger, redaction, error serialization
  root-logger.ts       Picks the sink and level by environment
```

The console sink is enough on Vercel, which collects stdout as runtime logs. Add a logging library (`pino-sink.ts`, say) only when the project needs something the console sink can't do, such as shipping logs to a service directly.

Vendor SDKs (pino, `@vercel/otel`, OpenTelemetry SDKs, Sentry, analytics SDKs, …) are imported only in sink files and `src/instrumentation.ts`, and `console` is a lint error elsewhere. Adding a vendor means adding a sink and selecting it in the root file; use-cases never change.

### Adding tracing

Until tracing is set up, `observe()` creates no spans, log lines carry no `traceId` or `spanId`, and the Drizzle client records no query events. To add it: install `@vercel/otel` and its OpenTelemetry peers (see `setup.md`), call `registerOTel()` in `src/instrumentation.ts`, then let `observe()` open a span per operation, the logger add `traceId` and `spanId`, and the Drizzle logger add each statement to the active span. Use-cases don't change.

### Adding analytics

Until analytics is set up, there is no `lib/analytics/`, no `events` field in `AppContext`, no `events.ts` in modules, and specs and tickets have no events section. To add it: build `lib/analytics/` (catalog, buffer, memory sink), add `events: EventRecorder` to `AppContext`, let `createRequestContext` create the buffer and `observe()` release it on success (see "What happens automatically"). A provider sink is a separate, later step (see "Analytics providers"); until then, events reach the logs as `analytics.event` lines. Then add `events.ts` to a module when its first event is worth tracking.

### Analytics providers

The architecture depends only on the `AnalyticsSink` interface, not on a provider. Any product analytics tool works (PostHog, Segment, Amplitude, Mixpanel, a data warehouse, your own endpoint). Analytics also works without a provider: events then go only to the logs, as `analytics.event` lines, and to the memory sink.

To add a provider:

1. Add `lib/analytics/sinks/<provider>-sink.ts` implementing `AnalyticsSink`: map each event's name, properties, user ID and timestamp to the provider's call. Use the provider's **server-side** SDK or HTTP API.
2. Make sure `capture` resolves only once the events are delivered: send them immediately or flush before returning (with PostHog's Node SDK, for example, `captureImmediate`; with batching SDKs, `await flush()`). Events are sent inside `after()`, and a serverless function may freeze as soon as that promise settles.
3. Select the sink in `root-analytics.ts` by environment, reading the provider's own environment variables. Without them, fall back to the memory sink.
4. Add the SDK to the `VENDORS` list in `eslint.boundaries.mjs` if it isn't there yet, so nothing outside the sink imports it.

Switching providers, or sending to two at once (a sink that fans out to several), changes only these files.

## What happens automatically

Every tRPC procedure, server action and route handler runs inside `observe()` (`src/server/observability.ts`):

- **A span** (once tracing is set up) named `trpc tasks.complete` / `action tasks.complete` / `route webhooks.stripe`, with request ID and user ID. Next.js adds spans for the incoming request and `fetch` calls, and the Drizzle logger adds every SQL statement as an event on the active span (without parameters, which contain user data).
- **One outcome line**, `operation.completed`, with `transport`, `operation`, `durationMs` and `outcome`:
  - `succeeded` (level `info`);
  - `rejected` with `code` and `kind`, for expected errors (level `info`; a user hitting a limit is not an incident);
  - `failed` with `code` and `reference`, for internal errors (level `warn`; the stack is in the separate `error.unexpected` line at level `error`).
- **Debug lines are held back.** In production the level is `info`, so `ctx.logger.debug(...)` lines are buffered per request (up to 200). They are dropped when the request succeeds or is rejected, and written with `flushedAfterError: true` when it fails with an internal error: full detail for exactly the requests you need to debug, at almost no cost.
- **Business events are released only on success** (once analytics is set up). Events emitted during a request are buffered; on success each is logged as `analytics.event` and sent to the analytics sink after the response (Next's `after()`), so analytics never slows a request down. A failed or rejected operation sends none, so analytics never reports something that didn't happen.
- **Errors Next catches itself** (server component renders, route handlers outside `observe()`) are logged by `onRequestError` in `src/instrumentation.ts`.

Every log line carries `requestId` and `userId` (and `traceId` and `spanId` with tracing), so logs, traces and the `reference` a user reports all point to the same request.

## What you write

| Layer | Logging | Events |
|---|---|---|
| Domain | Never. It's pure; it returns or throws, and the caller decides. | Never |
| Use-cases | `ctx.logger.debug(...)` at decision points (what was loaded, which branch was taken). `info` only for something an operator needs outside analytics. Never log an error you throw. | `ctx.events.emit(...)` after the state change the event reports, if the project has analytics |
| Persistence | Nothing; queries are traced automatically | Never |
| Delivery (routers, actions, route handlers) | Nothing; the middleware does it | Never |
| Outside requests (cron, scripts, startup) | `rootLogger`, or build a context with `createRequestContext` and call use-cases normally | Through the context |

Log calls use a stable, dot-namespaced event name and a fields object. Never interpolate values into the name; structured fields are searchable and the name stays groupable:

```ts
ctx.logger.debug("task.complete.loaded", { taskId, status });   // ✓
ctx.logger.debug(`loaded task ${taskId} with status ${status}`); // ✗ unsearchable, unstructured
```

Levels: `debug` for detail that matters only when something fails, `info` for facts an operator wants in normal operation, `warn` for degraded but handled situations (a retry, a fallback, a failed analytics delivery), `error` only through `toErrorPayload` and `onRequestError`. Don't log `error` yourself for errors you throw.

## Event catalog

Only in projects that have set up analytics. Each module declares its business events in `events.ts` with `defineEvent`. The catalog is the contract with analytics: stable names, typed properties, validated on emit, so a wrong property fails in tests instead of silently corrupting dashboards.

```ts
// modules/tasks/events.ts
export const taskCompleted = defineEvent(
  "task.completed",
  z.object({ taskId: z.string(), daysOpen: z.number().int().nonnegative(), onTime: z.boolean().nullable() }),
);
```

- Name events `<entity>.<past-tense verb>` (`task.completed`, `subscription.cancelled`). Never rename one; create a new event and keep the old one until dashboards have moved.
- Emit from use-cases, after the state change succeeded. One business fact, one event.
- Properties must never contain personal data (names, emails, free text). Use IDs, enums, counts, booleans and durations. The distinct ID (the user's ID) is added automatically.
- Include properties analysts will segment by (`onTime`, `daysOpen`), so they don't need a join to answer common questions.
- These server-side events are the reliable record of business facts. UI interactions (clicks, page views) belong to a client-side analytics SDK; both use the same user ID, so they can be joined.

## Redaction and data rules

- The logger redacts fields whose names match passwords, secrets, tokens, authorization headers, cookies, API keys, emails, phone numbers and IPs, at any depth, before any sink sees them. Redaction lives in `logger.ts`, not in the sink, so swapping libraries can't lose it. Extend the pattern there when a project has other sensitive fields.
- `Error` values in fields are serialized with name, message, stack, cause chain and, for `AppError`, `code`, `kind` and `details`.
- Never log full entities, rows or request bodies; log IDs and the few fields that explain a decision.

## Debugging a reported error

1. Take the `reference` the user saw (or the request ID from an alert). Search the logs for `requestId = <reference>`.
2. Read the lines in order: the flushed debug lines (`flushedAfterError: true`) show what the use-case loaded and decided; `error.unexpected` has the stack and cause chain; `operation.completed` has the operation and duration.
3. If the project has tracing, open the trace by its `traceId` to see the SQL statements and timings of that request.
4. Reproduce the bug, then fix it in the layer that's wrong.

## Vercel specifics

- **Logs:** the console sink writes one JSON line per entry to stdout. Vercel captures them as runtime logs; send them elsewhere with a Vercel log drain. Changing the destination needs no code change.
- **Traces** (if set up): `registerOTel()` from `@vercel/otel` in `src/instrumentation.ts`. Point traces at any OpenTelemetry backend with `OTEL_EXPORTER_OTLP_*` environment variables or a Vercel integration. Keep all traces that contain an error and sample successful ones in the backend's sampling settings.
- **Analytics** (if set up): events are sent inside `after()`, and the sink's `capture` resolves only after delivery (see "Analytics providers"), so they are delivered before the function freezes.
- **Configuration:** `LOG_LEVEL` (default `info` in production, `debug` locally); with tracing, `OTEL_SERVICE_NAME`; with an analytics provider, its own variables (for example `POSTHOG_API_KEY` and `POSTHOG_HOST`). Without a configured provider, events go to the memory sink. With `NODE_ENV=test`, logs (and events) go to memory sinks, so code under test can read what was logged and emitted.
