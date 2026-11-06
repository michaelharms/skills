# Domain modeling

Read this when modeling entities and value objects, writing business rules or validation that types can't express, or changing state.

## Contents

- Principles
- Example: the task entity
- Invariants vs preconditions
- Where each kind of rule goes
- Rules for `domain/`

## Principles

The domain model is independent of Drizzle. Tables are an infrastructure detail; the domain defines its own types, and `persistence/` maps between the two. That keeps business rules stable when storage changes and lets the domain run (and be tested) anywhere, including the browser.

Model so that **invalid states can't be represented**, rather than validating them after the fact:

- **Value objects are branded Zod schemas.** A plain `string` is not a `TaskTitle`; the only way to get one is through the schema, which enforces the rules. The brand is the type-level proof that the runtime check ran.
- **Entities are discriminated unions by state.** Each state has exactly the fields valid for it (`completedAt: null` when open, `Date` when completed), so an inconsistent combination doesn't type-check.
- **Entities are readonly plain data**, not classes, so they work with server components, Zod, structural equality and tests without ceremony.
- **Behavior is plain functions**: a factory for creation, one function per transition, and policy assertions. Each takes the entity (plus inputs like `now`) and returns a new entity or throws an error from `errors.ts`.
- **Every factory and transition returns through `ensureValid`**, which runs the entity schema. Rules the type can't express are checked on every state change, in one place.
- **Rehydration (`reconstituteTask`) re-checks invariants but not creation rules.** A task loaded from the database may have a due date in the past; a newly created one may not.

## Example: the task entity

```ts
// modules/tasks/domain/task.ts

// Value objects: the brand is proof that the runtime check ran.
export const taskId = z.uuid().brand<"TaskId">();
export type TaskId = z.infer<typeof taskId>;
export const taskTitle = z.string().trim().min(1).max(TASK_TITLE_MAX).brand<"TaskTitle">();
export type TaskTitle = z.infer<typeof taskTitle>;
export const estimateMinutes = z.number().int().positive().max(MAX_ESTIMATE_MINUTES).brand<"EstimateMinutes">();
export type EstimateMinutes = z.infer<typeof estimateMinutes>;

const base = {
  id: taskId, ownerId: userId, title: taskTitle, estimate: estimateMinutes.nullable(),
  dueDate: z.date().nullable(), createdAt: z.date(),
};

// Entity: shape and per-state fields in the type, cross-field invariants as refinements.
export const task = z
  .discriminatedUnion("status", [
    z.object({ ...base, status: z.literal("open"), completedAt: z.null() }),
    z.object({ ...base, status: z.literal("completed"), completedAt: z.date() }),
  ])
  .refine((t) => !t.dueDate || t.dueDate >= t.createdAt, { message: "dueDate is before createdAt", path: ["dueDate"] })
  .refine((t) => !t.completedAt || t.completedAt >= t.createdAt, { message: "completedAt is before createdAt", path: ["completedAt"] })
  .readonly();
export type Task = z.infer<typeof task>;
export type OpenTask = Extract<Task, { status: "open" }>;
export type CompletedTask = Extract<Task, { status: "completed" }>;

// Single choke point: every factory and transition returns through here.
function ensureValid<T extends Task>(candidate: T): T {
  const result = task.safeParse(candidate);
  if (!result.success) throw new TaskInvariantViolationError({ issues: result.error.issues });
  return candidate;
}

// Creation: preconditions, plus facts from outside the entity passed in by the use-case.
export function createTask(
  props: { id: TaskId; ownerId: UserId; title: TaskTitle; estimate: EstimateMinutes | null; dueDate: Date | null },
  now: Date,
  limits: { openTaskCount: number; maxOpenTasks: number },
): OpenTask {
  if (limits.openTaskCount >= limits.maxOpenTasks) throw new TaskLimitReachedError({ max: limits.maxOpenTasks });
  if (props.dueDate && props.dueDate < now) throw new TaskDueDateInPastError();
  return ensureValid({ ...props, status: "open", completedAt: null, createdAt: now });
}

// Transition: precondition explicit, invariants via ensureValid.
export function completeTask(t: Task, now: Date): CompletedTask {
  if (t.status === "completed") throw new TaskAlreadyCompletedError({ taskId: t.id });
  return ensureValid({ ...t, status: "completed", completedAt: now });
}

// Policy.
export function assertOwnedBy(t: Task, user: UserId): void {
  if (t.ownerId !== user) throw new TaskNotFoundError({ taskId: t.id });
}

// Rehydration: invariants yes, creation rules no.
export function reconstituteTask(raw: unknown): Task {
  const result = task.safeParse(raw);
  if (!result.success) throw new TaskInvariantViolationError({ issues: result.error.issues });
  return result.data;
}
```


## Invariants vs preconditions

Distinguish two kinds of rules, because they live in different places:

- **Invariants** hold for every task, always (title length, `completedAt` not before `createdAt`). They live in the entity schema and are checked by `ensureValid` and on rehydration.
- **Preconditions** hold only at the moment of an action (due date in the future when creating, can't complete twice, open-task limit). They are explicit `if`s in the factory or transition.

## Where each kind of rule goes

| Rule | Example | Where it lives |
|---|---|---|
| Shape and per-state fields | completed ⇒ has `completedAt` | The type (discriminated union) |
| One value against a threshold or format | estimate ≤ 480 min, title 1–200 chars | Branded value object with refinements |
| Several fields of one entity | `completedAt ≥ createdAt` | `.refine` on the entity schema; checked by `ensureValid` |
| Precondition of an action | can't complete twice, due date in the future at creation | Explicit `if` in the factory or transition |
| Depends on other entities in the same aggregate | at most 20 subtasks; subtask estimates ≤ parent's | Function on the aggregate root, which holds the children (`addSubtask(task, subtask)`) |
| Depends on data outside the entity | open-task limit per plan, referenced user exists | Domain function takes the facts as parameters; the use-case loads them |
| Must hold under concurrency | unique title per owner; limit with parallel requests | DB constraint or a transaction with a row lock in `persistence/`, mapped to a domain error |

The domain decides; it never fetches. When a rule needs outside data, the use-case loads it and passes it in. A check-then-write in application code is a race: if two requests can both pass the check, the database must enforce the rule too. The domain check then gives a good error message early, and the constraint is the guarantee.

## Rules for `domain/`

- No I/O, no `async`, no React, Next, tRPC, Drizzle, OpenTelemetry or `server-only`, no `lib/`. Allowed imports: Zod, other `domain/` folders (including other modules' value objects such as `UserId`), and its own module's `errors.ts` and `constants.ts`.
- Never construct or modify an entity outside `domain/`; call a domain function. The types catch most mistakes, but a fully consistent object can still be built by hand, skipping a transition's preconditions. Test fixtures build entities through domain functions too.
- Business rules live here. If a use-case, component or router contains an `if` about business state, move that check into a domain function.
- Name transitions after the business action (`completeTask`, `archiveTask`), not after the field they change (`setStatus`).
