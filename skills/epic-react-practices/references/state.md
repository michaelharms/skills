# State: where it lives and what shape it has

Read this when deciding where state lives, what shape it has, or whether to use `useState` or `useReducer`.

## Where state lives

Walk this ladder top to bottom and stop at the first rung that fits:

1. **Can it be computed?** If a value can be derived from props or other state, compute it during render. Do not store it and keep it in sync with an effect. If the calculation is genuinely expensive (measured), wrap it in `useMemo`.
2. **Does it belong in the URL?** Filters, tabs, pagination, search terms and selected items that a user would expect to survive reload or be shareable go in search params / route params.
3. **Is it server data?** Data from an API is a cache of server state, not UI state. Use the project's data layer (router loaders, TanStack Query, SWR, RSC, or a cached promise with `use()`). Hand-rolled `useState` + `useEffect` fetching is the last resort, and then it needs status modelling, cancellation and race handling (see `data-and-suspense.md`).
4. **Is it local UI state?** Use `useState` in the lowest component that needs it (colocation).
5. **Do siblings need it?** Lift it to their closest common parent, no higher.
6. **Is prop drilling getting painful?** First restructure with composition (pass `children` or elements as props, so intermediate components never see the data). Only then reach for context (see `composition-and-context.md`).

## Shape and API

- **Colocate aggressively.** If state only matters to one subtree, move it into that subtree. This improves readability and performance at the same time. When a feature is removed, its state should leave with it.
- **Store the minimal source of truth.** Keep `selectedId`, not a copy of the selected object. Keep the list, not the list plus its filtered version.
- **Model async status as one value**, never as parallel booleans:
  `type State = { status: 'idle' } | { status: 'pending' } | { status: 'resolved'; data: User } | { status: 'rejected'; error: Error }`.
  This makes "loading and error at the same time" unrepresentable.
- **useState vs useReducer.** Use `useReducer` when several values change together, when the next state depends on the previous one in non-trivial ways, when you want to describe *what happened* (actions) rather than *how to update*, or when you want the logic testable without React. Otherwise `useState` is fine.
- Use the functional update form (`setCount(c => c + 1)`) whenever the next value depends on the previous one.
- Use a lazy initializer (`useState(() => readFromStorage())`) when the initial value is expensive to compute.
- Never mutate state; create new objects and arrays.
