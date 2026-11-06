# Use-cases and persistence

Read this when writing an operation that loads or saves data, a query, or a transaction.

## Contents

- Use-cases
- `AppContext`
- Persistence
- Running use-cases outside a request

## Use-cases

One exported async function per file in `modules/<domain>/use-cases/`, named `<verb><Entity>UseCase`. Start each file with `import "server-only"`.

```ts
// modules/tasks/use-cases/complete-task.ts
import "server-only";

export async function completeTaskUseCase(ctx: AppContext, input: CompleteTaskInput): Promise<CompletedTask> {
  const existing = await findTaskById(ctx.db, input.taskId);
  ctx.logger.debug("task.complete.loaded", { taskId: input.taskId, status: existing?.status ?? "missing" });
  if (!existing) throw new TaskNotFoundError({ taskId: input.taskId });
  assertOwnedBy(existing, ctx.user.id);

  const completed = completeTask(existing, ctx.clock.now());
  await saveTask(ctx.db, completed);

  // Only in projects with analytics:
  ctx.events.emit(taskCompleted({ taskId: completed.id, daysOpen: daysBetween(completed.createdAt, completed.completedAt), onTime: … }));
  return completed;
}
```

**Shape:** load the entity and any facts the domain needs (persistence) → check policies and apply transitions (domain) → save (persistence) → emit events (in projects with analytics) → return.

**Delivery-agnostic.** A use-case must be callable from a tRPC procedure, a server action, a server component, a route handler, a cron job or a script without changes. Therefore:

- Everything comes in through `ctx`. Never call `headers()`, `cookies()`, `auth()` or `new Date()` inside a use-case; the delivery layer resolves those and builds `ctx`.
- It receives already-validated input (types from `schemas.ts`) and returns domain entities. Mapping to DTOs is the delivery layer's job.
- It throws errors from `errors.ts`, never `TRPCError`, `Response` or status codes.
- It never imports React, `next/*`, `@trpc/*`, `next-safe-action` or Drizzle.

**Data access.** A use-case never imports Drizzle or `db/` directly; it goes through its own module's `persistence/`. It may call another module's use-case (passing the same `ctx`), never another module's persistence.

**Logging and events.** Add `ctx.logger.debug(...)` at decision points (what was loaded, which branch was taken); debug lines cost almost nothing because they're only written when the request fails. In projects with analytics, emit business events after the state change succeeded. Never log an error you throw; the boundary logs it once. Details in `observability.md`.

**Business logic belongs in the domain.** If you're writing an `if` about the entity's state in a use-case, it's probably a precondition that belongs in a domain function (see `domain.md`). Authorization that depends on the entity (ownership) is a domain policy (`assertOwnedBy`); authentication (is anyone signed in) is handled by the delivery layer.

## `AppContext`

Defined in `src/lib/app-context.ts`. It is everything a use-case may use:

```ts
export type AppContext = {
  db: Db;
  user: { id: UserId };
  clock: { now: () => Date };
  logger: Logger;
  events: EventRecorder; // only in projects with analytics
};
```

The delivery layer builds it per request with `createRequestContext` (`src/server/context.ts`), which also attaches a request ID, a request-scoped logger and, with analytics, an event buffer. Code outside a request (tests, scripts, jobs) builds it with `createRequestContext` too. Add a field to `AppContext` only for a dependency many use-cases need; one-off dependencies are function parameters.

## Persistence

- Plain async functions in `modules/<domain>/persistence/` that take the db handle from `ctx`: `findTaskById(db, id)`, `saveTask(db, task)`, `listTasksForOwner(db, ownerId, filters)`. Start each file with `import "server-only"`. There are no repository interfaces; a function is enough to keep Drizzle out of the use-case.
- The only module code that imports Drizzle and `db/`. Tables live in `src/db/schema/<domain>.ts`.
- Rows go back to the domain through the entity's rehydration function (`reconstituteTask`), so corrupt data fails loudly at the boundary instead of deep in the app.
- Translate database constraint violations into domain errors (unique violation on `(owner_id, title)` → `DuplicateTaskTitleError`). Everything else bubbles up unchanged.
- Transactions and row locks for rules that must hold under concurrency live here too, exposed as functions the use-case calls, for example `withOwnerLock(db, ownerId, async (tx) => …)`.
- For read-heavy lists that don't need domain behavior, a query may return a read model (a DTO-shaped projection) instead of full entities.
- Never log row contents. With tracing, queries are traced automatically: the Drizzle logger in `src/db/client.ts` records each SQL statement on the active span, without parameters.

## Running use-cases outside a request

Cron jobs, scripts and background work build a context with `createRequestContext({ user, defer })` and call use-cases normally. Use a system user or the user the job acts for, and pass a `defer` that awaits the task (there is no response to send first). Logs, events and error handling then behave exactly as in a request.
