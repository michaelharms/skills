# Stories

Read this when writing or reviewing Storybook stories, or when a component, screen or shell is added or changes its visual states.

This applies to projects that use Storybook (see the "Setup" list in the project's `AGENTS.md`). Without Storybook, skip it, and don't set Storybook up as part of a feature.

Stories are where a component's visual states get built, reviewed and kept from regressing. They sit next to the component as `<name>.stories.tsx` (see `test-files.md`).

## Which components get stories

- Components in `components/primitives/`, `components/patterns/`, `components/shells/` and `modules/*/components/`, and screens in `screens/`.
- Not `page.tsx` or `layout.tsx` files: they only route to a screen or shell, which has the stories.

## One story per visual state

Give each visual state of the component its own story, not just the happy path:

- **Empty**: no data yet (an empty list, a new user).
- **Loading**: skeletons or pending UI, including a pending form submission.
- **Error**: each kind of failure the component shows differently, at least one user-facing error and the generic internal error with its reference.
- **Each meaningful variant**: the states of the entity it renders (an open and a completed task), permissions that change what's shown, long and short content.

When a component gains a visual state, add its story in the same change.

## Data for stories

- Feed stories with fixtures and DTOs, never with live data or network calls. Build entities through the module's fixtures (`domain/<entity>.fixtures.ts`), which create them through domain functions, and map them with the module's DTO mapper when the component receives DTOs. That way stories can't show states production can't reach.
- Error-state stories use real error payloads (`{ code: "task.limit_reached", kind: "forbidden", details: { max: 10 } }`) and render the message through `getErrorMessage` with the module's catalog, so the stories also show every user-facing error message.
- Screens that fetch on the server get their data as props in stories; keep data loading out of the screen's rendering part so it can be shown with fixtures.
