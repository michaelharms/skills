# Module contracts: schemas, DTOs, constants

Read this when writing input schemas, DTOs or constants. A module's root files are its client-safe contract (each created only once it has content): other modules and the UI use them, so they must not import server-only code, Drizzle or Node APIs.

| File | Holds | Details |
|---|---|---|
| `schemas.ts` | Zod input schemas for forms, procedures and actions | Below |
| `dtos.ts` | Shapes sent over the network, and their mappers | Below |
| `constants.ts` | Limits and defaults shared by domain, schemas and UI | Below |
| `errors.ts`, `error-messages.ts` | Error classes and their user-facing messages | `error-handling.md` |
| `events.ts` | Analytics event catalog, in projects with analytics | `observability.md` |
| `urls.ts` | Typed href builders | `ui-and-routing.md` |

## `schemas.ts`

Zod input schemas for forms, tRPC procedures and server actions, composed from the domain's value objects, so the client form and the server enforce the same rules:

```ts
export const createTaskInput = z.object({ title: taskTitle, dueDate: z.coerce.date().nullable() });
export type CreateTaskInput = z.infer<typeof createTaskInput>;

export const completeTaskInput = z.object({ taskId });
export type CompleteTaskInput = z.infer<typeof completeTaskInput>;
```

- Name schemas `<verb><Entity>Input` and filters `<entity>Filters`.
- Reuse value objects instead of restating their rules (`title: taskTitle`, not `z.string().min(1).max(200)`), so a rule changes in one place.
- Messages in value objects and input schemas reach users as field errors, so write them for users (`{ error: "Enter a title" }`). Refinement messages on entity schemas are for developers.
- Input schemas describe what a caller may send. Business rules that depend on state or other data are domain preconditions, not schema refinements.

## `dtos.ts`

DTOs define the shape that crosses the network to client code (tRPC queries consumed in client components, route handlers, external APIs), as a Zod schema plus inferred type.

```ts
export const taskDto = z.object({
  id: z.string(), title: z.string(), status: z.enum(["open", "completed"]),
  dueDate: z.iso.datetime().nullable(), completedAt: z.iso.datetime().nullable(),
});
export type TaskDto = z.infer<typeof taskDto>;

export function toTaskDto(t: Task): TaskDto {
  return { id: t.id, title: t.title, status: t.status, dueDate: t.dueDate?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null };
}
```

- A DTO owns serialization: `toTaskDto(task)` turns rich types into wire-safe ones (`Date` → ISO string, brands and internal fields dropped); `taskDto.parse(...)` restores them on the client.
- Use-cases return entities. The **delivery layer** applies `toTaskDto`, because serialization is a delivery concern and the same use-case may be called by something that wants the entity.
- If the transport already round-trips the types in question (server actions and server components serialize `Date`, `Map` and `Set`; tRPC does with the superjson transformer), add a DTO only when the client should see a different shape than the entity. Without such a need, the module has no `dtos.ts`.
- Never put data in a DTO that the caller isn't allowed to see; a DTO is a public contract.

## `constants.ts`

Limits and defaults used by more than one of domain, schemas and UI (`TASK_TITLE_MAX`, `MAX_ESTIMATE_MINUTES`). Keep it free of imports from other layers so the domain may import it. Values that differ per environment belong in the typed env (`src/lib/env.ts`), not here.
