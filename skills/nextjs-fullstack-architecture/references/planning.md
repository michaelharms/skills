# Planning: specs, tickets and ADRs

Read this when writing or reviewing a spec (PRD), an issue or ticket, an implementation plan or an ADR, or when interviewing someone about a feature, with or without a planning tool.

This reference defines **what** a planning document must settle so the architecture can be built from it. It doesn't prescribe a tool or a document format: use whichever planning tool or template the project uses, and make sure its output covers the points below. The templates in `assets/templates/` are a fallback for when there's no planning tool.

## Contents

- Where planning docs live
- Domain language
- What every spec must settle
- Names, not file paths
- Tickets: vertical slices
- ADRs
- Working with planning and review tools
- Without a planning tool
- Bug reports

## Where planning docs live

Follow the project's configuration; don't invent locations. If the project's `CLAUDE.md` or `AGENTS.md` (or a file it points to) says where the glossary, ADRs, specs or tickets live, use that. Otherwise use these defaults:

| What | Where |
|---|---|
| Domain glossary | `GLOSSARY.md` at the repo root. A Next.js app is one context, so modules don't get their own glossaries. Only a monorepo with several apps needs one glossary per app, plus an index at the root. |
| ADRs | `docs/adr/0001-slug.md`, numbered sequentially (scan for the highest number and add one) |
| Coding standards for reviews | `CODING_STANDARDS.md` at the repo root (see `review-checklist.md`) |
| Specs and tickets | The project's issue tracker, as configured; if none is named, ask |

Create the glossary and ADRs lazily, when there's something to write. If the project already keeps a glossary under another name, use that file.

## Domain language

The glossary (`GLOSSARY.md`) defines the domain's terms for domain experts; it holds no implementation details. The code takes its names from it:

| Glossary term | Becomes |
|---|---|
| **Task** | module `modules/tasks/`, entity file `domain/task.ts`, type `Task` |
| A **Task** is *completed* | transition `completeTask`, use-case `completeTaskUseCase`, event `task.completed` |
| A **Task** can't be found | error code `task.not_found` |
| Terms listed under `_Avoid_` | never used as names in code |

When planning surfaces a new term or a conflict ("account" meaning both customer and user), resolve it in the glossary first, then name the code. If a spec uses a word the glossary doesn't have, either it's inventing language the project doesn't use, or the glossary has a gap to fill.

## What every spec must settle

A spec is ready to build when it answers these questions. Ask them while interviewing; check them when reviewing. Each answer lands in a specific part of the architecture, so a missing answer becomes a guess in code.

| Question | Why it matters here | Lands in |
|---|---|---|
| Which entities and states are involved, and which actions move between states? | Each state is a variant of the entity's union; each action is a transition | `domain/` (`domain.md`) |
| Which rules apply? For each: is it always true (invariant), true at the moment of an action (precondition), about who may do it (policy), dependent on other data, or at risk under concurrency? | Each kind is implemented in a different place | `domain/`, use-case, DB constraint (`domain.md`) |
| What does the user see when each rule is broken? | Each failure is an error with a code, a kind and a message | `errors.ts`, `error-messages.ts` (`error-handling.md`) |
| Who may do this, and what do others see? | Policies in the domain; other users' resources are `not_found` | `domain/`, delivery auth |
| If the project has analytics: which business events matter, with which properties? | Events are a contract with analytics; adding them later leaves a gap | `events.ts` (`observability.md`) |
| What data changes? New fields, tables, constraints, migrations? | Persistence and its constraints; migrations must be planned | `db/schema/`, `persistence/` |
| How is it triggered: interactive UI, a form, a webhook or job? | Picks the delivery mechanism among those the project uses (tRPC, server actions, a route handler, a script); needing a transport the project doesn't have is a decision of its own | `delivery.md` |
| What's out of scope? | Keeps slices thin | |

Rules and their failures read well as a table in any spec format:

| Rule | Kind | When broken, the user sees |
|---|---|---|
| Only the owner can archive a task | policy | not_found: "This task doesn't exist or was deleted." |
| Only completed tasks can be archived | precondition | conflict: "Only completed tasks can be archived." |
| Archived tasks keep their completion date | invariant | (internal; users can't trigger it) |

**Settle these before writing the spec, not after.** Spec- and ticket-writing tools often synthesize from the conversation without interviewing, and may publish their output as ready for an agent. Resolve open questions while interviewing, or the implementing agent fills the gaps with guesses.

## Names, not file paths

Describe implementation decisions in the architecture's vocabulary: modules, entities, states, transitions, use-cases and their inputs, error codes and kinds, events, procedures or actions. Leave out file paths and code. The structure already determines where each named thing lives, and paths in planning documents go stale as code moves.

> Module `tasks`: new state `archived` (with `archivedAt`), transition `archiveTask`, precondition "must be completed" (`task.not_completed`, conflict), event `task.archived { taskId, daysSinceCompleted }`, use-case `archiveTaskUseCase(ctx, { taskId })`, exposed as tRPC `tasks.archive`.

An exception that common spec tools share: when a prototype produced a type shape or state machine that says it more precisely than prose, inline the decision-carrying part.

## Tickets: vertical slices

Split a spec into tickets that each cut through every layer and are demoable on their own. In this architecture a slice is built inside out: domain → errors and events → persistence and use-case → procedure or action → UI.

- **The first slice of a new entity is the tracer bullet:** the entity with one transition, one use-case, one procedure or action, minimal UI. Later slices add one rule, state or screen each.
- **Prefactoring comes first**, as its own ticket that blocks the others: moving code into the right module or layer so the feature lands cleanly.
- **A slice's acceptance criteria include its failures and events**, not just the happy path: one criterion per rule in its table, and, in projects with analytics, "event X is recorded once per occurrence".
- **A ticket is ready for an agent** when its rules, failures, permissions and events are settled, and it introduces no new layer, vendor or cross-cutting mechanism. Otherwise it needs a human decision first, often an ADR.
- Describe end-to-end behavior; the technical part names the pieces (see above) without a layer-by-layer task list, since the layers follow from the rules.
- **Wide mechanical changes** (renaming a column, retyping a shared value object) don't fit a vertical slice: sequence them as expand, migrate in batches, contract.

## ADRs

**When.** Write an ADR when a decision is hard to reverse, would surprise a future reader, and came from a real trade-off. Typical cases here:

- deviating from this skill for the whole project (always surprising, so always an ADR);
- adding a top-level folder, a layer or a transport the project doesn't use yet (tRPC or server actions when it has only the other, GraphQL, a queue consumer);
- setting up optional infrastructure that brings a vendor (tracing, analytics), or choosing or replacing an infrastructure vendor (database, auth, logging, analytics, tracing);
- changing a cross-cutting mechanism (error kinds, `AppContext`, the observability middleware, the lint boundaries);
- rejecting a refactoring proposal for a reason a future reviewer would need, so it isn't proposed again.

Don't write ADRs for decisions this skill already makes; `decisions.md` records those (D1–D23) and their reasons.

**Format.** Keep it short; the value is recording that a decision was made and why.

```markdown
# Use Postgres row-level security for multi-tenancy

Every table carries `tenant_id`, and RLS policies enforce isolation in the database, because a missed
`where` in persistence would leak data across tenants. Overrides D4 of nextjs-fullstack-architecture:
persistence functions run inside a transaction that sets the tenant.
```

- One to three sentences of context, decision and reason are often enough. Add a status, considered options or consequences only when they help a future reader (`assets/templates/adr.md`).
- When the ADR overrides a decision of this skill, name it (`Overrides D4 …`), and add a line to the "Deviations" list in the project's `CLAUDE.md` / `AGENTS.md` linking the ADR, so agents follow the deviation.
- Accepted ADRs aren't edited; a later change gets a new ADR that supersedes the old one.

**Seed ADR.** When a project adopts this architecture, record that in an ADR (`assets/templates/adr-adopt-architecture.md`). Planning, review and refactoring tools that read `docs/adr/` then see the architecture's constraints even when this skill isn't loaded, and won't propose undoing deliberate choices such as thin routers.

## Working with planning and review tools

The project may use other skills or tools for interviewing, writing specs and tickets, implementing, reviewing or retrospectives. This skill doesn't depend on any of them: whatever produces the documents, they must cover the requirements here, and the tool's own format and file locations win where they differ from the defaults above.

Other tools may not load this skill, but they usually read the project's steering file, ADRs, glossary and coding-standards files. That's how the architecture reaches them: the `AGENTS.md` section, the seed ADR, `GLOSSARY.md` and `CODING_STANDARDS.md` (see `setup.md`).

What this skill adds at each kind of step:

| Step | What this skill adds |
|---|---|
| Interviewing about a feature | The questions in "What every spec must settle"; new terms go into the glossary first; decisions that meet the ADR criteria become ADRs |
| Writing a spec | In the implementation decisions: the rules table, failures, permissions, events, data changes and delivery choice, as names rather than paths. User stories cover the failure cases too |
| Splitting into tickets | Vertical slices built inside out; acceptance criteria per rule and event; prefactoring first |
| Implementing | The reference for each layer, built inside out |
| Reviewing | `review-checklist.md`, condensed into the project's `CODING_STANDARDS.md` for tools that read standards files; spec conformance is checked separately from standards |
| Retrospectives | Mechanical findings become lint rules in the project's ESLint config (tightening is fine; loosening `eslint.boundaries.mjs` needs an ADR). Judgement calls go into `CODING_STANDARDS.md` |
| Refactoring proposals | Stay within the layers and decisions here: a module's interface is its use-cases and contract files, and a thin delivery adapter isn't dead weight to remove. Anything that changes the architecture is an ADR |

If a tool's conventions contradict this skill's decisions (for example, `index.ts` entry points against D6), the project decides: follow the skill, or record an ADR that overrides the decision.

## Without a planning tool

Use the templates in `assets/templates/`:

- `spec.md`: problem, solution, user stories, implementation and testing decisions, out of scope, with the rules table and, in projects with analytics, the events table.
- `issue.md`: what to build, rules, events, acceptance criteria, blocked by.
- `adr.md`: the short ADR format with optional sections.

## Bug reports

Include the `reference` from the user's error message or the request ID (see "Debugging a reported error" in `observability.md`), observed vs expected behavior, and the part of the code believed to be wrong.
