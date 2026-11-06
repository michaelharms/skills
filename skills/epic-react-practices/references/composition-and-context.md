# Composition and context

Read this when props are passed through layers that don't use them, a component is growing configuration props, or you're considering context, portals or imperative refs.

## Composition first

Reach for **composition first**. A component that accepts `children` or element props (`header={<UserAvatar user={user} />}`) does not need to know about the data its children use, which removes most prop drilling without any context.

**Use when** intermediate components forward props they don't use, or a component is growing configuration props (`showAvatar`, `avatarSize`, `titleVariant`...) to cover every caller.

**Instead of:**

```tsx
function App() {
  const [user] = useUser()
  return <Layout user={user} />
}
function Layout({ user }: { user: User }) {
  return <Header user={user} />
}
function Header({ user }: { user: User }) {
  return <nav><Avatar user={user} /></nav>
}
```

**Do:**

```tsx
function App() {
  const [user] = useUser()
  return <Layout header={<Header avatar={<Avatar user={user} />} />} />
}

function Layout({ header, children }: { header: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="layout">
      {header}
      <main>{children}</main>
    </div>
  )
}

function Header({ avatar }: { avatar: React.ReactNode }) {
  return <nav>{avatar}</nav>
}
```

`Layout` and `Header` no longer know what a user is. The component that owns the data renders the component that needs it. Try this before reaching for context.

## Context

- Use **context** for values that are genuinely cross-cutting (theme, current user, locale) or for the private state of a compound component (`patterns/compound-components.md`). Don't build one giant app-wide context.
- Context recipe:
  - create it with a `null` default,
  - export a provider component and a `useX()` hook, not the raw context,
  - make `useX()` throw a helpful error when used outside the provider.
- If a provider re-renders often for unrelated reasons, memoize its value; if consumers only need to dispatch, split state and dispatch into separate contexts. Do this when it matters, not by default (details in "Context performance" in `performance.md`).

## Portals and imperative refs

- Use portals (`createPortal`) or the native `<dialog>` for modals, popovers and tooltips that must escape overflow/stacking contexts.
- `useImperativeHandle` / imperative refs are an escape hatch for things that really are imperative (focus, scroll, play). Don't use them to push state into children.
