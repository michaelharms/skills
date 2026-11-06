# Writing components

Read this when writing component markup, lists and keys, conditional rendering, accessibility and focus, or prop types.

## Rendering fundamentals

- Rendering must be pure: no side effects, no mutation of props, state or module variables during render. Strict Mode double-renders to expose violations, so don't "fix" those by removing Strict Mode.
- Render components as elements (`<Item />`), never call them as functions (`Item()`). Calling them makes their hooks part of the parent and breaks the rules of hooks.
- Use stable, unique `key`s from the data. Use array indexes only for lists that never reorder, insert or delete.
- Use `key` deliberately to reset a component's state when its identity changes (`<Profile key={userId} />`) rather than an effect that resets state.
- Prefer a ternary to `&&` when the left side might be a number: `{count ? <Badge count={count} /> : null}` avoids rendering a stray `0`.

Forms have their own reference: `forms.md`.

## Accessibility and focus

- Interactive things are buttons or links, not clickable `div`s. Keyboard users must be able to reach and operate everything.
- Every input gets a label (`<label htmlFor>` with `useId()` for the id, or a wrapping `<label>`).
- After an action changes what's on screen (opening an edit form, deleting an item, closing a dialog), move focus somewhere sensible. If you need to focus an element that's rendered by the same state update, wrap the update in `flushSync` before calling `.focus()`.
- Keep ARIA state in sync with real state (`aria-expanded`, `aria-pressed`, `aria-selected`, `aria-invalid` + `aria-describedby` for errors). Prop getters are a good place to centralize this (`patterns/prop-getters.md`).
- Use portals (`createPortal`) or the native `<dialog>` for modals, popovers and tooltips that must escape overflow/stacking contexts.

## TypeScript

- Type props explicitly. Extend native elements with `React.ComponentProps<'button'>` (or `ComponentPropsWithoutRef`) instead of re-declaring their props.
- Model state with discriminated unions (see `state.md`) so TypeScript forces you to handle every case.
- Avoid `any`; prefer `unknown` plus narrowing (e.g. a Zod schema) for data from outside the app.
- Let inference work for local values; annotate function boundaries (props, hook params and returns).
