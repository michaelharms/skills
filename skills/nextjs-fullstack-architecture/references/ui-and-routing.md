# UI and routing

Read this when building a page, layout, screen, component, form or link.

## Contents

- `app/`: routing only
- `screens/`
- `components/`
- Module components and hooks
- Forms
- Links and typed routes

## `app/`: routing only

`app/` maps URLs to screens and nothing more, so routing concerns (params, redirects, metadata, loading and error boundaries) stay separate from what the page shows.

- `page.tsx` does three things: read and validate `params`/`searchParams`, call `notFound()`/`redirect()` if needed, render one screen. No markup beyond that.
- `layout.tsx` renders a shell from `components/shells`, plus providers.
- `error.tsx` / `global-error.tsx` show a generic message and `error.digest` (for support), never `error.message`.
- No `_components` folders and no business logic. `app/` never imports `db/` or a module's `use-cases/` or `persistence/`.

```tsx
// src/app/(app)/tasks/[taskId]/page.tsx
import { TaskDetailScreen } from "@/screens/tasks/task-detail-screen";

export default async function Page({ params }: PageProps<"/tasks/[taskId]">) {
  const { taskId } = await params;
  return <TaskDetailScreen taskId={taskId} />;
}
```

## `screens/`

- One screen per route, named `<name>-screen.tsx`, grouped by area: `screens/tasks/task-list-screen.tsx`.
- Screens compose module components and may fetch data: server components call use-cases with a context from `server/context.ts`, or, in projects with tRPC, prefetch tRPC queries.
- In server components, errors from use-cases go through `handleRscError` (`server/rsc-errors.ts`): `not_found` → `notFound()`, `unauthorized` → `redirect("/login")`, anything else rethrown to the nearest `error.tsx`.
- Screens are never imported by modules, and a screen never renders another screen.

## `components/`

- `primitives/`: building blocks only (shadcn/ui components, if the project uses it, or its own). They may import only other primitives and `lib/`. With shadcn/ui, prefer wrapping a primitive over editing the generated file, so regenerating it stays safe; `components.json` points shadcn's `ui` alias at `@/components/primitives`. A project that doesn't use shadcn/ui yet can add it when a change first needs one of its primitives: ask the user, then follow "Adding shadcn/ui" in `setup.md`.
- `patterns/`: reusable composites that know nothing about any domain. If a component mentions a domain concept (a task, a user), it belongs in that module.
- `shells/`: page chrome and navigation.

## Module components and hooks

- Domain UI lives in `modules/<domain>/components/`, client hooks in `modules/<domain>/hooks/`. A module's UI may use any module's contract files and components, and its own hooks and utils.
- Client code reaches the server only through the project's transport: tRPC hooks from `server/trpc/react.tsx`, or server actions with `useAction`. It never imports use-cases, persistence, `server/` (other than `trpc/react.tsx` and types) or `db/`.
- Components receive DTOs, not domain entities, when the data came over the network.

## Forms

- Validate with the module's input schema from `schemas.ts`, so the form and the server enforce the same rules. Give value objects and input schemas user-readable messages (`z.string().min(1, { error: "Enter a title" })`).
- Submit through a server action (`useAction`) or a tRPC mutation, whichever the project uses.
- On error, put field errors on their fields and show the message for the rest (the example uses a server action; a tRPC mutation's `onError` works the same way):

```tsx
const { execute } = useAction(completeTaskAction, {
  onError: ({ error }) => {
    for (const [field, [message]] of Object.entries(getFieldErrors(error))) form.setError(field, { message });
    toast.error(getErrorMessage(error, taskErrorMessages));
  },
});
```

For the full client-side error API (`getErrorMessage`, `getFieldErrors`, `getErrorReference`, catch-alls), see `error-handling.md`.

## Links and typed routes

`typedRoutes: true` is enabled in `next.config.ts`. Every internal href for a domain is built in that module's `urls.ts`. Each builder has an explicit `Route` return type, so Next validates the template literal against the real routes:

```ts
import type { Route } from "next";

export const taskUrls = {
  list: (): Route => "/tasks",
  detail: (taskId: string): Route => `/tasks/${taskId}`,
  edit: (taskId: string): Route => `/tasks/${taskId}/edit`,
};
```

- Never write `as Route`; a cast disables the check. Build URLs with template literals, not concatenation.
- Serialize search params from the module's Zod filter schema, so the page and the link share one definition.
- When a route moves, change `urls.ts` once; the type checker then points at every page that no longer exists.
