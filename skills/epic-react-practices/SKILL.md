---
name: epic-react-practices
description: React coding guidelines in the style Kent C. Dodds teaches in Epic React - where state should live, deriving instead of syncing state, disciplined effects, composition over prop drilling, the advanced component patterns (compound components, slots, prop getters, state reducer, control props), forms and actions, Suspense and transitions, error boundaries, measured performance work, accessibility, and Testing Library practices. Use this skill whenever writing, refactoring or reviewing React components or hooks (.jsx/.tsx), building a form, designing a reusable component or hook API, deciding where state or data fetching belongs, chasing re-renders or slow renders, writing tests for React code, or setting the skill up in a project - even if the user never mentions Kent C. Dodds or Epic React.
license: MIT
---

# Epic React practices

Guidelines for writing React the way Kent C. Dodds teaches it in Epic React, his blog and his testing material. This is an unofficial distillation, not something published by Kent or Epic Web. It is framework-agnostic: it applies to Vite SPAs, Next.js, React Router / Remix, or anything else that renders React.

**The project wins over this skill.** Before applying anything here, look at how the codebase already does things (data library, router, styling, test setup, lint rules). If the project has a deliberate convention, follow it and only raise a concern if it causes a real bug. Deviations listed in the project's `AGENTS.md` or `CLAUDE.md` are deliberate: follow them and don't "fix" them. These guidelines are for filling gaps and making judgment calls, not for rewriting working code to match a style.

This file holds the mindset and the rules that apply to almost every component. The details, code and less common cases live in reference files: open only the ones the task needs (see "Read only what the task needs").

## Mindset

These ideas sit underneath every rule. When a situation isn't covered, reason from them.

- **Simplicity first.** Write the most straightforward thing that works. Add indirection (context, reducers, patterns, memoization) only when a concrete problem demands it, and be able to say what that problem is.
- **Avoid hasty abstractions (AHA).** Duplication is cheaper than the wrong abstraction. Wait until you have seen the real variations of a thing before generalizing it, and prefer inlining a bad abstraction over adding another parameter to it.
- **Optimize for change.** Code that is easy to understand, move and delete beats code that is clever. Colocate things that change together (state, styles, tests, helpers) with the code that uses them.
- **Make impossible states impossible.** Model data so contradictory combinations can't be represented, instead of guarding against them at runtime.
- **Use the platform.** Prefer semantic HTML, native form behavior, `<button>`, `<label>`, `<dialog>` and real links. They are accessible and well-tested by default.
- **Inversion of control.** When a reusable component needs to support "one more case", give consumers control (composition, render content, reducers) instead of adding another configuration prop and `if` branch.

## Rules for every component

1. **Rendering is pure.** No side effects or mutation of props, state or module variables during render. Render components as elements (`<Item />`), never call them as functions.
2. **Keys are stable and come from the data.** Change a `key` to reset a component's state when its identity changes, instead of an effect that resets state.
3. **Derive, don't sync.** If a value can be computed from props or state, compute it during render; never store it and keep it in sync with an effect.
4. **State lives as low as possible.** Shareable state goes in the URL, server data in the project's data layer, local UI state in `useState` in the lowest component that needs it, lifted only to the closest common parent.
5. **Async status is one value.** Model it as a discriminated union (`idle | pending | resolved | rejected`), never as parallel booleans.
6. **Effects synchronize with something outside React**, and nothing else. They clean up, handle races and keep honest dependencies (never silence `react-hooks/exhaustive-deps`). Responses to user actions go in event handlers.
7. **Composition before context.** Solve prop drilling with `children` and element props first; use context for genuinely cross-cutting values, through a guarded `useX()` hook.
8. **Accessible by default.** Semantic, labelled, keyboard-operable elements, with focus moved somewhere sensible after actions. Build this into the first version, not later.
9. **Measure before optimizing.** `useMemo`, `useCallback` and `memo` only for measured expensive work or where referential stability matters, and not at all by default under the React Compiler.
10. **Test like a user.** Render, interact through accessible queries and user-event, assert on what the user sees, and mock only the network.

## Read only what the task needs

| When you are… | Read |
|---|---|
| Writing component markup, lists and keys, conditional rendering, accessibility and focus, or prop types | `references/components.md` |
| Deciding where state lives, what shape it has, or `useState` vs `useReducer` | `references/state.md` |
| Writing an effect or a custom hook, subscribing to an external store, or needing the latest value of a callback | `references/effects-and-hooks.md` |
| Fighting prop drilling, building layout components, or using context, portals or imperative refs | `references/composition-and-context.md` |
| Designing a reusable component or hook API (compound components, slots, prop getters, state reducer, control props) | `references/component-apis.md`, then only the pattern file it points to |
| Building a form, a form action, pending or optimistic UI | `references/forms.md` |
| Loading data, using Suspense or `use()`, transitions, avoiding waterfalls, `useDeferredValue` | `references/data-and-suspense.md` |
| Handling errors: error boundaries, errors in event handlers and async code | `references/error-boundaries.md` |
| Making something faster | `references/performance.md` |
| Writing or reviewing tests | `references/testing.md` |
| Reviewing or refactoring React code | `references/review-checklist.md` (it links to the rest) |
| Setting this skill up in a project | "Setting up a project" below |

The larger references start with a table of contents; read the sections you need.

## How to work with this skill

**When writing a new component or hook**

1. Check the project's existing conventions (data fetching, forms, styling, tests).
2. Decide where each piece of state lives (`references/state.md`), and derive everything else.
3. Build the simplest version with plain props and composition.
4. Add effects only for external synchronization, with cleanup.
5. Add accessibility (labels, roles, focus) as part of the first version, not later.
6. Write or update an integration test that drives it like a user.

**When refactoring or reviewing**, follow `references/review-checklist.md`: report findings in order of impact, say what to change and why, and leave code that's fine alone.

**When asked to make something faster**, ask for or gather a measurement first, then follow `references/performance.md` in order.

## Setting up a project

When asked to set up this skill in a project, point the project's agents here:

1. Use whichever of `AGENTS.md` / `CLAUDE.md` the project already has. Never create both; if it has neither, create `AGENTS.md`.
2. If the file already has the section, leave it alone. Otherwise add the section from `assets/agents-md-snippet.md` after any other tools' sections (such as the `nextjs-fullstack-architecture` "Architecture" section). Keep it short: this file loads into every agent's context.
3. In an existing codebase, look for deliberate conventions that contradict this skill and list them in the report as candidate deviations. Record only the ones the user confirms, each with why (or a link to its ADR).
4. Report what was added, and leave the change uncommitted for the user to review, unless asked to commit.
