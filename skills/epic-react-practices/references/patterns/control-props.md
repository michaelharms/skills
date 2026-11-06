# Control props

**Use when** a consumer needs to own a piece of state entirely: synchronize two components, persist to the URL, or apply rules the reducer can't express. This is the same idea as `value` + `onChange` on `<input>`.

This builds on the state reducer (`state-reducer.md`): `toggleReducer`, `ToggleState` and `ToggleAction` come from there.

```tsx
export function useToggle({
  initialOn = false,
  reducer = toggleReducer,
  on: controlledOn,
  onChange,
}: {
  initialOn?: boolean
  reducer?: (state: ToggleState, action: ToggleAction) => ToggleState
  on?: boolean
  onChange?: (state: ToggleState, action: ToggleAction) => void
} = {}) {
  const { current: initialState } = useRef<ToggleState>({ on: initialOn })
  const [state, dispatch] = useReducer(reducer, initialState)

  const onIsControlled = controlledOn != null
  const on = onIsControlled ? controlledOn : state.on

  function dispatchWithOnChange(action: ToggleAction) {
    if (!onIsControlled) {
      dispatch(action)
    }
    onChange?.(reducer({ ...state, on }, action), action)
  }

  const toggle = () => dispatchWithOnChange({ type: 'toggle' })
  const reset = () => dispatchWithOnChange({ type: 'reset', initialState })

  return { on, toggle, reset }
}
```

Usage: two toggles that always match.

```tsx
function App() {
  const [bothOn, setBothOn] = useState(false)
  const handleChange = (state: ToggleState) => setBothOn(state.on)

  return (
    <>
      <Switch on={bothOn} onChange={handleChange} />
      <Switch on={bothOn} onChange={handleChange} />
    </>
  )
}
```

Make control props safe to use, the way React does for inputs. In development, warn when:
- `on` is passed without `onChange` (and without an explicit `readOnly`), because the component will look broken,
- a component switches between controlled and uncontrolled during its lifetime (`on` goes from `undefined` to a boolean or back).

Implement the warnings in a small `useControlPropWarnings` hook that tracks whether the prop was controlled on the first render with a ref, and wrap them in `if (process.env.NODE_ENV !== 'production')` (or `import.meta.env.DEV`).
