# Test file placement

Read this when creating, moving or reviewing test, story or fixture files.

This skill decides only **where** test files go, plus which stories components need (`stories.md`). How to test (what to test, at which level, with which tools and assertions) follows the project's testing guidelines or whichever testing skill the project uses.

## Next to the file they cover

Tests, stories and fixtures live next to the file they cover, with the same base name. Never in `__tests__/`, `__stories__/`, `__mocks__/`, `tests/` or `stories/` folders under `src/`; lint rejects those.

```
modules/tasks/
  components/
    task-card.stories.tsx
    task-card.test.tsx
    task-card.tsx
  domain/
    task.fixtures.ts
    task.test.ts
    task.ts
  use-cases/
    complete-task.test.ts
    complete-task.ts
```

- **Suffixes:** `.test.ts(x)` for tests, `.stories.tsx` for Storybook stories (in projects with Storybook), `.fixtures.ts` for test data builders. Lint tells test code from production code by these suffixes.
- **Moving, renaming, deleting:** a file's test, story and fixtures move, get renamed and get deleted with it.
- **Imports:** tests, stories and fixtures may import anything they need; production code may never import them (lint enforces both).
- **Flat folders apply to tests too:** a test sits in the same layer folder as its file, never in a subfolder (see "Flat folders and imports" in `structure.md`).

## Fixtures

Builders for test data (`anOpenTask()`, `aCompletedTask()`) go in a `.fixtures.ts` file next to the entity they build, once a test or story needs them: `modules/<module>/domain/<entity>.fixtures.ts`. Tests and stories share them.

Fixtures create entities through domain functions (`createTask`, `completeTask`), never by writing entity objects by hand. That's the domain rule "never construct an entity outside `domain/`" applied to test data: data that skips the domain functions can represent states production can never reach.

## End-to-end tests

End-to-end tests cover routes and journeys, not files, so they are the one exception: they live in `e2e/` at the project root, outside `src/`.

## Test infrastructure

- With `NODE_ENV=test`, the root logger (and analytics, if the project has it) write to memory sinks (`memory-sink.ts`), so code under test can read what was logged and emitted without a vendor. See `observability.md`.
- Code outside a request, tests included, builds an `AppContext` with `createRequestContext` (see `use-cases-and-persistence.md`).
