# Reviewing and refactoring React code

Read this when reviewing or refactoring React components, hooks or tests.

## How to review

- Respect the project's deliberate conventions; raise a concern only if one causes a real bug.
- Report findings in order of impact: bugs and accessibility first, then state and effect design, then style.
- For each finding, say what to change and why in one or two sentences. Don't rewrite code that's fine.
- Open a reference only for the areas where you found something and need the details.

## Checklist

| Check | Details |
|---|---|
| Is any state derivable from other state or props? Is any effect syncing derived state? | `state.md`, `effects-and-hooks.md` |
| Does state live as low as possible, and is server data handled by a data layer rather than ad-hoc effects? | `state.md`, `data-and-suspense.md` |
| Are async states modelled as a single status value rather than several booleans? | `state.md` |
| Does every effect have a real external system, correct dependencies and a cleanup? Any race conditions? | `effects-and-hooks.md` |
| Are event-driven updates done in handlers instead of effects? | `effects-and-hooks.md` |
| Are keys stable? Is `key` used for resets where an effect was resetting state? | `components.md` |
| Is prop drilling solved with composition before context? Does each context have a guarded `useX()` hook? | `composition-and-context.md` |
| Do reusable components use the simplest pattern that meets real needs, and do they compose consumer handlers? | `component-apis.md` |
| Are forms real `<form>`s with labelled inputs, and are pending and error states handled? | `forms.md` |
| Are there error boundaries around features with a way to recover? Are Suspense boundaries placed where loading UI makes sense? | `error-boundaries.md`, `data-and-suspense.md` |
| Is any memoization unmeasured or unnecessary (or redundant with the React Compiler)? | `performance.md` |
| Are elements semantic, labelled, keyboard-operable, with focus managed after actions? | `components.md` |
| Do tests query by role/label, use user-event, mock the network with MSW and avoid implementation details? | `testing.md` |
