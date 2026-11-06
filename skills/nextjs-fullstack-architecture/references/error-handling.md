# Error handling

Read this when throwing, mapping or displaying errors.

## Contents

- The flow
- Error classes
- Choosing the kind
- Who throws and who catches
- Transports
- Messages on the client
- Using errors in components

## The flow

Errors are thrown where a rule is broken, translated to a transport format once at the delivery boundary, and turned into human-readable text only on the client.

```
domain / use-case / persistence      server/ (delivery)                            client
throw TaskLimitReachedError    →     toErrorPayload():                       →     getErrorMessage(error, taskErrorMessages)
  code  "task.limit_reached"           expected → { code, kind, details }           1. module catalog by code
  kind  "forbidden"                    internal → logged with stack,                2. common catalog by code
  details { max: 10 }                             { code, kind, reference }         3. message by kind
                                       status from kind (403)                        4. generic message
```

## Error classes

Every expected error extends `AppError` from `src/lib/errors/app-error.ts` and carries three things:

- **`code`**: a stable, namespaced identifier (`task.limit_reached`). The client chooses the message by code. Never rename a code casually; it's part of the API, like a URL.
- **`kind`**: one of `validation | unauthorized | forbidden | not_found | conflict | rate_limited | internal`. The kind decides the HTTP/tRPC status and the fallback message, so a new error needs no mapping code.
- **`details`**: typed, JSON-safe data for the message (`{ max: 10 }`). It is sent to the browser, so it may only contain what the user is allowed to see: no other users' data, no SQL, no stack.

```ts
// modules/tasks/errors.ts
export class TaskLimitReachedError extends AppError<"task.limit_reached", { max: number }> {
  readonly code = "task.limit_reached";
  readonly kind = "forbidden";
}

/** A bug or corrupt data, never a user mistake: logged with details, shown as a generic error. */
export class TaskInvariantViolationError extends AppError<"task.invariant_violation", { issues: ReadonlyArray<Issue> }> {
  readonly code = "task.invariant_violation";
  readonly kind = "internal";
}

export type TaskError = TaskNotFoundError | TaskAlreadyCompletedError | TaskLimitReachedError | TaskInvariantViolationError /* … */;
```

- Export every module's error union (`TaskError`), so its message catalog can be checked for completeness.
- Cross-cutting errors (`UnauthorizedError`, `ForbiddenError`, `RateLimitedError`) live in `src/lib/errors/common-errors.ts`.
- Errors without details take no constructor argument: `new TaskDueDateInPastError()`.

## Choosing the kind

Choose by **who has to act**:

| Kind | Status | Use when | Example |
|---|---|---|---|
| `validation` | 400 | The user can fix the input | due date in the past |
| `unauthorized` | 401 | The user must sign in | no session |
| `forbidden` | 403 | The user may not do this (role, plan, limit) | open-task limit reached |
| `not_found` | 404 | The thing doesn't exist, or the user may not know it exists | task of another user |
| `conflict` | 409 | The state changed or clashes; retrying after a reload may help | already completed, duplicate title |
| `rate_limited` | 429 | Too many attempts | login throttling |
| `internal` | 500 | Only a developer can fix it | invariant broken after input validation passed, corrupt row |

An invariant violation means a bug got past input validation; it is not a message for the user, so it's `internal`. Return `not_found` rather than `forbidden` for resources of other users, so their existence doesn't leak.

## Who throws and who catches

- **Domain, use-cases and persistence throw** `AppError`s and never catch, except to translate: persistence turns database constraint violations into domain errors (`DuplicateTaskTitleError`). Everything else bubbles up.
- **Never throw `TRPCError`, `Response` or status codes** outside `src/server/`.
- **Never catch an error just to log it and rethrow.** Logging happens once, at the boundary; a second log line for the same error makes incidents look twice as large.
- **Delivery catches**, in one place per transport, all built on `toErrorPayload()` in `src/server/errors.ts`, the only place that decides what the client sees:
  - input validation failures (Zod or any Standard Schema issues) → `validation.invalid_input` with `fieldErrors`;
  - an `AppError` with a user-facing kind → `{ code, kind, details }`;
  - an `internal` `AppError` or any unknown error → logged once with its stack (`error.unexpected`, level `error`) and recorded on the span, then reduced to `{ code, kind: "internal", reference }`. The `reference` is the request ID, which finds the logs and trace of exactly that request.

## Transports

Only the rows for the transports the project uses apply; the others' files don't exist.

| Transport | Where errors are handled | Client receives |
|---|---|---|
| tRPC | `trpc/init.ts`: a middleware gives each `AppError` the tRPC code for its kind (which sets the HTTP status); the `errorFormatter` adds `data.appError` and replaces the message of internal errors. `isDev` is true only in local development, so stack traces never reach test, preview or production clients. | `TRPCClientError` with `data.appError` |
| Server actions | `server/actions/client.ts`: `handleServerError` of the `next-safe-action` client returns `toErrorPayload(error, ctx)`; input validation failures come back as flattened `validationErrors` | `{ data }`, `{ serverError: ErrorPayload }` or `{ validationErrors }` |
| Route handlers | `defineRouteHandler` (`server/route-handler.ts`) catches, calls `toErrorPayload(e, ctx)` and responds with the status for the kind | `{ error: ErrorPayload }` + HTTP status |
| Server components | `handleRscError(e)`: `not_found` → `notFound()`, `unauthorized` → `redirect("/login")`, anything else rethrown to the nearest `error.tsx` | Not-found page, login redirect or error boundary |

## Messages on the client

Each module has a message catalog in `error-messages.ts`: one function per user-facing code, receiving that error's typed details. `satisfies ErrorMessages<TaskError>` makes it exhaustive, so adding a user-facing error without a message, or misspelling a details field, fails type-checking. Internal errors are excluded; they never get a specific message.

```ts
// modules/tasks/error-messages.ts
export const taskErrorMessages = {
  "task.not_found": () => "This task doesn't exist or was deleted.",
  "task.already_completed": () => "This task is already completed.",
  "task.limit_reached": ({ max }) => `You can have at most ${max} open tasks. Complete or delete some first.`,
  /* … */
} satisfies ErrorMessages<TaskError>;
```

`getErrorMessage(error, ...catalogs)` in `src/lib/errors/error-messages.ts` accepts anything: a tRPC client error, a `next-safe-action` result or `useAction` error, a payload, or an unknown thrown value. It resolves in this order:

1. the catalogs passed in, by code (pass every module whose errors the call can produce);
2. the common catalog (auth, rate limiting), by code;
3. a message per kind (`conflict` → "This was changed in the meantime. Reload and try again.");
4. a generic message.

Internal errors always end at step 3, so users never see technical text. If the app is localized, catalogs return translation keys or receive the `t` function; the structure stays the same.

## Using errors in components

```tsx
// tRPC
const complete = trpc.tasks.complete.useMutation({
  onError: (error) => toast.error(getErrorMessage(error, taskErrorMessages)),
});

// Server action
const { execute } = useAction(completeTaskAction, {
  onError: ({ error }) => {
    for (const [field, [message]] of Object.entries(getFieldErrors(error))) form.setError(field, { message });
    toast.error(getErrorMessage(error, taskErrorMessages), { description: referenceText(getErrorReference(error)) });
  },
});
```

- `getFieldErrors(error)` returns validation errors keyed by field for both transports (`_form` for errors without a field).
- `getErrorReference(error)` returns the support reference of internal errors. Show it ("Reference: 7f3a…") so a user report leads straight to the logs and trace.
- Catch-all for mutations without `onError`: a global `MutationCache({ onError })` on the QueryClient shows `getErrorMessage(error)`. Queries show errors in the component that renders them.
- Render errors go to `error.tsx` / `global-error.tsx`, which show a generic message and `error.digest`, never `error.message`.
