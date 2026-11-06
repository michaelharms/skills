# Review checklist

Read this when reviewing code, a diff or a pull request, and before finishing your own change. Check only the sections for the layers the change touches. Each item names the reference to open when you need the details.

## Contents

- How to review
- Every change
- Domain
- Use-cases and persistence
- Contracts
- Delivery
- Errors
- Observability
- UI
- Tests
- Test files
- Stories
- Writing the review

## How to review

1. Run lint, type check and tests first. Boundary errors and type errors are already findings; don't restate them by hand.
2. Map the changed files to layers (`structure.md`) and go through the matching sections below.
3. Look for what lint can't see: business rules in the wrong layer, hand-built entities, personal data in logs or events, missing messages.
4. Respect project deviations listed in the project's `CLAUDE.md` / `AGENTS.md` and its ADRs; don't flag them.
5. If there's a spec or ticket, also check the change against it (missing requirements, scope creep), separately from the standards findings.

The project's `CODING_STANDARDS.md` (from `assets/templates/coding-standards.md`) is a condensed copy of the judgement calls below, for review tools that read standards files but not this skill. It also tells generic smell checklists which patterns are deliberate: thin procedures and actions aren't Middle Men, entity ↔ row ↔ DTO mappings aren't Duplicated Code. When a rule here changes, update that template too. If a reviewer keeps missing something mechanical, make it a lint rule instead of another line in the file.

## Every change

- [ ] Files are where `structure.md` puts them; no new folders, no barrel files, kebab-case names.
- [ ] No empty or placeholder files and folders; every new file has real content, and files left empty by the change are deleted.
- [ ] Only infrastructure in the project's "Setup" list is used (its transport, tracing, analytics, Storybook); adding a new piece is called out as a decision, not slipped into a feature.
- [ ] Names of modules, entities, transitions, events and error codes use the domain glossary's terms (`GLOSSARY.md`), not its "avoid" aliases.
- [ ] The change does what its issue or spec settled (rules, failures, events); differences are either explained or fed back into the issue.
- [ ] No disabled lint rules (`eslint-disable`) and no widened boundary config.
- [ ] Tests, stories and fixtures sit next to the file they cover, with its base name; moved or deleted files took theirs along.

## Domain

See `domain.md`.

- [ ] Business rules (ifs about entity state, thresholds, cross-field rules) are in `domain/`, not in use-cases, routers or components.
- [ ] New values with rules are branded value objects; new states are variants of the discriminated union.
- [ ] Factories and transitions return through `ensureValid`; rehydration doesn't apply creation rules.
- [ ] Rules that need outside data take it as parameters; rules that must hold under concurrency also have a DB constraint or lock.
- [ ] No I/O, `async`, frameworks or `lib/` imports; nothing constructs entities by hand.

## Use-cases and persistence

See `use-cases-and-persistence.md`.

- [ ] One use-case per file, `<verb><Entity>UseCase`, starts with `import "server-only"`.
- [ ] Everything comes from `ctx`; no `headers()`, `cookies()`, `auth()`, `new Date()`.
- [ ] Data access goes through the module's own `persistence/`; another module is reached through its use-cases.
- [ ] Returns entities, not DTOs; throws `AppError`s, not `TRPCError` or responses.
- [ ] Persistence rehydrates through the domain, maps constraint violations to domain errors, and doesn't log rows.

## Contracts

See `contracts.md`.

- [ ] Input schemas reuse value objects instead of restating rules; user-facing messages are written for users.
- [ ] DTOs contain only what the caller may see; the delivery layer applies the mapper.
- [ ] Contract files import nothing server-only.

## Delivery

See `delivery.md`.

- [ ] Procedures and actions only validate → call one use-case → map to a DTO (if the module has one). No logic, no `try/catch`, no logging.
- [ ] The change uses the project's transport, not one it hasn't chosen.
- [ ] Actions use `authActionClient`/`actionClient` with `.metadata({ name })`; procedures use `protectedProcedure` where a user is required.
- [ ] Route handlers exist only where the project's transport doesn't fit, and use `defineRouteHandler`.

## Errors

See `error-handling.md`.

- [ ] New errors extend `AppError` with a namespaced code, the right kind (who has to act) and client-safe details.
- [ ] Every user-facing error has a message in the module's catalog (type-checked by `satisfies ErrorMessages<…>`).
- [ ] Bugs and corrupt data are `internal`, not user-facing kinds; other users' resources are `not_found`.
- [ ] No catch-log-rethrow; no error codes renamed.
- [ ] UI passes the right catalogs to `getErrorMessage`, puts field errors on fields, shows the reference for internal errors.

## Observability

See `observability.md`.

- [ ] Log calls use `ctx.logger` with dot-namespaced names and fields; no interpolated messages, no `console`, no vendor SDKs.
- [ ] `debug` at decision points in use-cases; no logging in domain, persistence or delivery; no error-level logs for thrown errors.
- [ ] With analytics: new business facts emit an event from the module's catalog, after the state change; properties contain no personal data. Without analytics: no events, spans or vendor SDKs were added on the side.
- [ ] No full entities, rows or request bodies in logs.

## UI

See `ui-and-routing.md`.

- [ ] `page.tsx` only parses params, handles not-found/redirects and renders one screen; layouts render shells.
- [ ] Domain components are in their module; `patterns/` and `primitives/` stay domain-free.
- [ ] Links come from the module's `urls.ts`, without `as Route`.
- [ ] Client components reach the server only through the project's transport (tRPC hooks or server actions) and receive DTOs where the module has them.

## Tests

How to write tests follows the project's testing guidelines or testing skill; check the change against those. What the tests must cover comes from this architecture:

- [ ] Every new or changed rule is tested: each invariant and precondition, including the case where it's broken.
- [ ] Each user-facing error the change introduces is produced by a test, asserted by its error class or code (codes are API; message text isn't).
- [ ] Permissions are tested from the other side too: another user gets `not_found`, an anonymous user `unauthorized`.
- [ ] With analytics, business events are asserted: emitted once on success, not emitted when the operation fails or is rejected.
- [ ] A bug fix comes with a test that fails without the fix.
- [ ] No test builds entities by hand or reaches into another layer's internals to arrange data; fixtures go through domain functions.

## Test files

See `test-files.md`. How tests are written follows the project's testing guidelines, not this skill.

- [ ] Fixtures (`*.fixtures.ts`) sit next to the entity they build and create entities through domain functions, never by hand.
- [ ] End-to-end tests are in `e2e/`, outside `src/`.

## Stories

Only in projects with Storybook. See `stories.md`.

- [ ] New or changed components and screens have a story for each visual state (empty, loading, error, each meaningful variant), including states this change added.
- [ ] Stories are fed by fixtures and DTOs, not live data or network calls; error stories use real error payloads and the module's message catalog.

## Writing the review

Group findings by severity, most important first:

- **Must fix**: violates a rule here and causes a bug, data leak, or architectural drift (business rule in a router, personal data in an event, missing `server-only`, swallowed error).
- **Should fix**: violates a rule without immediate harm (missing debug line at a key decision, a story missing a visual state).
- **Consider**: improvements beyond the rules.

For each finding give the file and line, what's wrong, why it matters (one sentence, referencing the rule), and the concrete fix. Mention what the change does well when it's notable; a review that only lists problems hides which patterns to repeat.
