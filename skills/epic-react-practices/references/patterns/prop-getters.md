# Prop collections and prop getters

**Use when** a hook provides behavior that must be applied to elements the consumer renders, and getting the props right (event handlers + ARIA) matters.

A **prop collection** is an object of props to spread. It is simple but breaks as soon as the consumer needs their own `onClick`, because spreading order decides who wins. A **prop getter** is a function that merges the consumer's props with the hook's props and composes handlers. Prefer getters.

```tsx
function callAll<Args extends unknown[]>(...fns: Array<((...args: Args) => unknown) | undefined>) {
  return (...args: Args) => fns.forEach((fn) => fn?.(...args))
}

export function useToggle() {
  const [on, setOn] = useState(false)
  const toggle = () => setOn((prev) => !prev)

  function getTogglerProps<Props extends React.ComponentProps<'button'>>({
    onClick,
    ...props
  }: Props = {} as Props) {
    return {
      'aria-pressed': on,
      type: 'button' as const,
      onClick: callAll(onClick, toggle),
      ...props,
    }
  }

  return { on, toggle, getTogglerProps }
}
```

Usage:

```tsx
const { on, getTogglerProps } = useToggle()

<button {...getTogglerProps({ onClick: () => analytics.track('toggled'), id: 'lights' })}>
  {on ? 'On' : 'Off'}
</button>
```

The consumer's `onClick` and the hook's `toggle` both run. Order the merge so consumer props can override non-handler attributes when they need to.
