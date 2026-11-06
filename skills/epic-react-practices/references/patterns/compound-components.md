# Compound components

**Use when** several components only make sense together and share state the consumer shouldn't have to wire up: Tabs, Accordion, Menu, Select, Disclosure. It lets the consumer control structure and markup while the parent owns behavior.

```tsx
import { createContext, use, useState } from 'react'

type ToggleContextValue = { on: boolean; toggle: () => void }

const ToggleContext = createContext<ToggleContextValue | null>(null)

function useToggleContext() {
  const context = use(ToggleContext)
  if (!context) {
    throw new Error('Toggle compound components must be rendered within <Toggle>')
  }
  return context
}

export function Toggle({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false)
  const toggle = () => setOn((prev) => !prev)
  return <ToggleContext value={{ on, toggle }}>{children}</ToggleContext>
}

export function ToggleOn({ children }: { children: React.ReactNode }) {
  const { on } = useToggleContext()
  return on ? children : null
}

export function ToggleOff({ children }: { children: React.ReactNode }) {
  const { on } = useToggleContext()
  return on ? null : children
}

export function ToggleButton(props: Omit<React.ComponentProps<'button'>, 'onClick'>) {
  const { on, toggle } = useToggleContext()
  return <button type="button" aria-pressed={on} onClick={toggle} {...props} />
}
```

Usage (any structure, any depth):

```tsx
<Toggle>
  <ToggleOn>The lights are on</ToggleOn>
  <ToggleOff>The lights are off</ToggleOff>
  <div className="controls">
    <ToggleButton>Flip the switch</ToggleButton>
  </div>
</Toggle>
```

Notes:
- Use context, not `React.Children.map` + `cloneElement`. Cloning only reaches direct children and breaks as soon as someone wraps a child in a `div`.
- The guarded hook turns "used outside the parent" into a clear error instead of a confusing `undefined`.
- You can attach parts as static properties (`Toggle.Button`) if the codebase prefers that style; named exports tree-shake better and work well with RSC boundaries.
- Code targets React 19 (`<Context value>`, `use(Context)`); on React 18, use `<Context.Provider value>` and `useContext`.
