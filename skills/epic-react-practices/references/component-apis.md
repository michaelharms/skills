# Choosing a reusable-component pattern

Read this when designing the API of a reusable component or hook. It tells you which pattern fits; then open only that pattern's file.

Start with plain props and composition. Upgrade only when a real consumer needs more flexibility than the current API gives them.

| Situation | Pattern | Read |
|---|---|---|
| Too many config props, or props passed through layers that don't use them | **Composition / layout components** (`children`, element props) | `composition-and-context.md` |
| An effect or memoized callback needs the *latest* value of a prop without re-running | **Latest ref** / `useEffectEvent` | "Latest ref" in `effects-and-hooks.md` |
| Several pieces work together and share state implicitly (Tabs, Accordion, Menu, Toggle) | **Compound components** with context | `patterns/compound-components.md` |
| Reusable building blocks (label, input, description, error) that take on a role depending on the parent they're placed in | **Slots** | `patterns/slots.md` |
| A hook must wire up event handlers and ARIA attributes correctly on elements the consumer renders | **Prop collections → prop getters** (getters compose the consumer's own handlers) | `patterns/prop-getters.md` |
| Consumers need to change *how* internal state transitions happen | **State reducer** | `patterns/state-reducer.md` |
| Consumers need to fully own a piece of state (like `value` / `onChange`) | **Control props** | `patterns/control-props.md` (builds on the state reducer) |

The pattern files use a deliberately simple toggle so the pattern itself stays visible; adapt them to the real component. Code targets React 19 (`<Context value>` instead of `<Context.Provider value>`, `use(Context)`); on React 18, use `.Provider` and `useContext`.

## Rules of thumb

- Library-style components that many teams consume justify state reducer and control props; app-level components rarely do.
- Whatever pattern you choose, keep the consumer's handlers working (compose them, don't overwrite them) and keep accessibility attributes correct.
- Export the default reducer and action types when offering a state reducer, so consumers can delegate to it.

## Combining patterns

Real components often combine these. A good library-grade toggle or select might be:

- a hook (`useToggle`) with a **state reducer** and **control props** for logic,
- **prop getters** for wiring elements,
- **compound components** built on that hook for the common case,
- **slots** for shared form primitives.

Build up to this only as real requirements appear. An app component used in two places needs none of it.
