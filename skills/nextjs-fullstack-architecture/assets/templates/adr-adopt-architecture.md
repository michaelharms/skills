# Follow the nextjs-fullstack-architecture conventions

This app follows the `nextjs-fullstack-architecture` skill (https://github.com/michaelharms/skills/tree/main/skills/nextjs-fullstack-architecture),
so that code, reviews and plans share one structure, enforced by `eslint.boundaries.mjs`. We chose vertical modules with
a pure domain over organizing by technical layer only, because they keep business rules testable and reusable across
transports and jobs.

Constraints that plans, reviews and refactorings must respect:

- Code is organized in vertical modules (`src/modules/<module>/`) with a pure `domain/` (entities, rules, transitions),
  `use-cases/` that receive everything through a context, and `persistence/` as the only module code that touches the
  database. A module's interface is its use-cases and its contract files (schemas, DTOs, errors, events, URLs).
- tRPC procedures, server actions and route handlers are deliberately thin: validate input, call one use-case, map the
  result. Middleware handles errors, logs, traces and analytics for all of them. Don't propose merging them into the
  use-cases or removing them as pass-throughs.
- The transport (tRPC, server actions or both) and the optional pieces (tracing, analytics, Storybook) are chosen per
  project and listed under "Setup" in CLAUDE.md / AGENTS.md. Adding one is a decision, not part of a feature.
- Persistence is plain functions without repository interfaces, because there is one implementation.
- Layer folders are flat, with no index files or barrels; each thing is imported from the file that defines it.
- Rules the type system can't express are checked by the domain on every state change; rules that must hold under
  concurrency are also enforced by database constraints.
- Every user-facing failure is an error with a stable code, a kind (which sets the HTTP status) and a message in the
  module's catalog. With analytics, business events are declared per module and emitted by use-cases after a
  successful change.
- Tests, stories and fixtures sit next to the code they cover; with Storybook, components and screens have a story per
  visual state.
- Files and optional infrastructure are added when they get content, never as empty placeholders.
- Deviations from these conventions need their own ADR and an entry under "Deviations" in CLAUDE.md / AGENTS.md.

<!-- Save as docs/adr/NNNN-follow-nextjs-fullstack-architecture.md (0001 in a new project). -->
