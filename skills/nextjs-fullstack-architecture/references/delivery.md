# Delivery: tRPC, server actions, route handlers

Read this when adding a tRPC procedure, a server action or a route handler, or when touching auth or the request context.

Each project decides whether it uses tRPC, server actions (with `next-safe-action`), or both; the choice is recorded in the "Setup" list of the project's `AGENTS.md`. Use the transport the project has. Don't add the other one as part of a feature: adding a transport is a decision of its own (see "Choosing the transport"). If the "Setup" list says the transport is undecided, ask the user before writing the first procedure or action, and record the answer there.

## Contents

- Layout of `src/server/`
- Choosing the transport
- tRPC procedures
- Server actions
- Route handlers
- Server components
- Request context and auth

## Layout of `src/server/`

```
server/
  actions/             Only if the project uses server actions
    client.ts          next-safe-action clients (actionClient, authActionClient)
    tasks.ts           "use server" actions, one per use-case
  trpc/                Only if the project uses tRPC
    routers/
      tasks.ts
    init.ts            tRPC init, observability + error middleware, error formatter, base procedures
    react.tsx          tRPC React client ("use client"); the only server/ file client code may import
    root.ts            Merges domain routers into appRouter
  auth.ts              getCurrentUser() from the session (wraps your auth library)
  context.ts           createRequestContext(): AppContext + request ID, request logger (+ event buffer with analytics)
  errors.ts            describeError, toErrorPayload, HTTP status per kind
  observability.ts     observe(): outcome log, debug flush (+ span with tracing, event release with analytics)
  route-handler.ts     defineRouteHandler(), once the first route handler is needed
  rsc-errors.ts        handleRscError(): maps errors in server components to notFound()/redirect()
```

If the project doesn't have the files a change needs yet, build them first (see "Building shared pieces on first use" in `setup.md`). Build only those: a project without route handlers has no `route-handler.ts`.

## Choosing the transport

The choice is made once per project, at setup, and changed only by a deliberate decision (an ADR when it replaces one transport with the other):

- **tRPC** fits apps where client components fetch and cache data: lists that refetch, optimistic updates, mutations from interactive UI that update cached queries.
- **Server actions** fit apps that read in server components and mutate through forms: progressive enhancement, mutations that end in a redirect or revalidation. They need no client cache or API layer.
- **Both** fit apps with both needs; then use tRPC for client-fetched data and actions for forms.

With either or both, behavior is the same for errors, logs, traces and events, because every transport runs through `observe()` and `toErrorPayload()`. The sections below on tRPC and server actions apply only if the project uses that transport.

A procedure or action does exactly this: validate input with the module's schema → call one use-case with `ctx` → map the result with the module's DTO mapper, if the module has one → return. No business logic, no `try/catch`, no logging: the middleware handles errors, spans and outcome logs once for every operation, so code here that does it again creates duplicates and inconsistencies.

Delivery code never imports a module's `persistence/` or `domain/` directly; it goes through use-cases, contract files and DTO mappers.

## tRPC procedures

```ts
// src/server/trpc/routers/tasks.ts
export const tasksRouter = router({
  complete: protectedProcedure
    .input(completeTaskInput)
    .mutation(async ({ ctx, input }) => toTaskDto(await completeTaskUseCase(ctx, input))),
});
```

- One router per module in `routers/<module>.ts`, merged in `root.ts`. The procedure path (`tasks.complete`) becomes the span name and the `operation` in logs.
- `protectedProcedure` rejects anonymous requests with `UnauthorizedError` and narrows `ctx.user` to non-null; `publicProcedure` doesn't.
- Never throw `TRPCError` yourself. Throw an `AppError` subclass; the middleware maps its kind to the tRPC code and HTTP status.

## Server actions

Server actions are built with `next-safe-action` from `server/actions/client.ts`, never as bare `"use server"` functions, so that they get the same context, error payloads, validation errors and observability as tRPC.

```ts
// src/server/actions/tasks.ts
"use server";

export const completeTaskAction = authActionClient
  .metadata({ name: "tasks.complete" })
  .inputSchema(completeTaskInput)
  .action(async ({ ctx, parsedInput }) => toTaskDto(await completeTaskUseCase(ctx, parsedInput)));
```

- Every action gets `.metadata({ name: "<module>.<operation>" })`; the client requires it. The name becomes the span name and `operation` in logs.
- `authActionClient` rejects anonymous requests and narrows `ctx.user`; `actionClient` allows them.
- The result on the client is `{ data }`, `{ serverError: ErrorPayload }` or `{ validationErrors }` (flattened). `getErrorMessage` and `getFieldErrors` read all of them (see `error-handling.md`).
- `redirect()` and `notFound()` work inside actions: `next-safe-action` recognizes them and reports navigation to `useAction` instead of an error.

## Route handlers

Use route handlers only for things the project's transport doesn't fit: webhooks, file downloads, public or third-party APIs. Build them with `defineRouteHandler` from `server/route-handler.ts`, which gives them the same context, span, outcome log, analytics flush and error payloads (`{ error: ErrorPayload }` with the status for its kind):

```ts
// src/app/api/webhooks/billing/[accountId]/route.ts
export const POST = defineRouteHandler<{ accountId: string }>("billing.webhook", async (req, ctx, { accountId }) => {
  const input = billingEventInput.parse(await req.json());
  return Response.json(await handleBillingEventUseCase(ctx, { ...input, accountId }));
});
```

Webhooks from third parties usually have no session: verify the provider's signature inside the handler before calling the use-case, and run the use-case as the account the event belongs to.

The tRPC handler itself lives in `src/app/api/trpc/[trpc]/route.ts` and only wires `fetchRequestHandler` to `appRouter` and `createRequestContext`.

## Server components

Screens may call use-cases directly when rendering on the server. Build the context with `createRequestContext({ user: await getCurrentUser() })` and route errors through `handleRscError(error)` from `server/rsc-errors.ts`: `not_found` → `notFound()`, `unauthorized` → `redirect("/login")`, anything else rethrown to the nearest `error.tsx`.

## Request context and auth

- `getCurrentUser()` in `server/auth.ts` is the only place that reads the session. Wrap the project's auth library there; nothing else imports it.
- `createRequestContext({ user, defer })` builds the `AppContext` plus `requestId` and a `scope` used by `observe()` (debug buffer, event buffer, `defer` = Next's `after()`). Use-cases never touch `scope`.
- tRPC builds the context in its route handler; the action client builds it in its first middleware. Tests and scripts call `createRequestContext` themselves.
