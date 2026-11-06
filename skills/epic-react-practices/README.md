# epic-react-practices

React guidelines in the style [Kent C. Dodds](https://kentcdodds.com) teaches in [Epic React](https://www.epicreact.dev), his blog and his testing material. The skill gives your agent the mindset and the rules behind them: where state lives, deriving instead of syncing, effects only for synchronizing with the outside world, composition before context, the advanced component patterns, forms and actions, Suspense, error boundaries, measured performance work, accessibility, and tests that use the app like a user does.

This is an unofficial distillation, not something published by Kent C. Dodds or Epic Web. It's framework-agnostic: it applies to Vite SPAs, Next.js, React Router / Remix, or anything else that renders React.

## Install

Claude Code:

```bash
/plugin marketplace add michaelharms/skills
/plugin install epic-react-practices@michaelharms
```

Codex, Cursor, GitHub Copilot and other agents:

```bash
npx skills add michaelharms/skills --skill epic-react-practices
```

Updating, team-wide installs and manual installs are covered in the [repository README](../../README.md).

## Setup

None. The skill loads on its own when the agent writes, refactors, reviews or tests React components or hooks, or works on forms, state, data loading or performance.

The project's conventions win over the skill. The agent looks at how the codebase already does things (data library, router, styling, test setup, lint rules) and follows them; the skill fills gaps and guides judgement calls instead of rewriting working code to match a style.

To make sure every agent in a project uses it, add a line to the project's `AGENTS.md` or `CLAUDE.md`:

```md
Use the `epic-react-practices` skill when writing, reviewing or testing React code.
```

## What it covers

| Topic | Reference |
|---|---|
| Markup, lists and keys, conditional rendering, accessibility and focus, prop types | [`components.md`](references/components.md) |
| Where state lives, its shape, `useState` vs `useReducer` | [`state.md`](references/state.md) |
| Effects, custom hooks, external stores, the latest value of a callback | [`effects-and-hooks.md`](references/effects-and-hooks.md) |
| Prop drilling, layout components, context, portals, imperative refs | [`composition-and-context.md`](references/composition-and-context.md) |
| Reusable component and hook APIs: compound components, slots, prop getters, state reducer, control props | [`component-apis.md`](references/component-apis.md) |
| Forms, form actions, pending and optimistic UI | [`forms.md`](references/forms.md) |
| Data loading, Suspense, `use()`, transitions, waterfalls, `useDeferredValue` | [`data-and-suspense.md`](references/data-and-suspense.md) |
| Error boundaries, errors in event handlers and async code | [`error-boundaries.md`](references/error-boundaries.md) |
| Making things faster, measured first | [`performance.md`](references/performance.md) |
| Testing with Testing Library and user-event | [`testing.md`](references/testing.md) |
| Reviewing or refactoring React code | [`review-checklist.md`](references/review-checklist.md) |

## What's inside

`SKILL.md` is what the agent loads: the mindset, ten rules for every component, and which reference to read for which task. References load only when a task needs them.

```
epic-react-practices/
  references/
    patterns/
      compound-components.md
      control-props.md
      prop-getters.md
      slots.md
      state-reducer.md
    component-apis.md
    components.md
    composition-and-context.md
    data-and-suspense.md
    effects-and-hooks.md
    error-boundaries.md
    forms.md
    performance.md
    review-checklist.md
    state.md
    testing.md
  README.md
  SKILL.md
```

## License

[MIT](../../LICENSE)
