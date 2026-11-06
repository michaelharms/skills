# State reducer

**Use when** consumers need to customize *how* internal state changes in response to events (prevent a change, clamp a value, change what "reset" means) without forking the component. Typical in widely shared libraries (downshift popularized it).

Expose the default reducer and action types so consumers can delegate to them and only override the cases they care about.

```tsx
import { useReducer, useRef } from 'react'

export type ToggleState = { on: boolean }
export type ToggleAction = { type: 'toggle' } | { type: 'reset'; initialState: ToggleState }

export function toggleReducer(state: ToggleState, action: ToggleAction): ToggleState {
  switch (action.type) {
    case 'toggle':
      return { on: !state.on }
    case 'reset':
      return action.initialState
  }
}

export function useToggle({
  initialOn = false,
  reducer = toggleReducer,
}: {
  initialOn?: boolean
  reducer?: (state: ToggleState, action: ToggleAction) => ToggleState
} = {}) {
  const { current: initialState } = useRef<ToggleState>({ on: initialOn })
  const [state, dispatch] = useReducer(reducer, initialState)

  const toggle = () => dispatch({ type: 'toggle' })
  const reset = () => dispatch({ type: 'reset', initialState })

  return { on: state.on, toggle, reset }
}
```

Consumer that limits clicks:

```tsx
function App() {
  const [timesClicked, setTimesClicked] = useState(0)
  const clickedTooMuch = timesClicked >= 4

  const { on, toggle, reset } = useToggle({
    reducer(state, action) {
      if (action.type === 'toggle' && clickedTooMuch) {
        return state
      }
      return toggleReducer(state, action)
    },
  })

  return (
    <>
      <button onClick={() => { toggle(); setTimesClicked((c) => c + 1) }}>{on ? 'On' : 'Off'}</button>
      {clickedTooMuch ? (
        <button onClick={() => { reset(); setTimesClicked(0) }}>Reset</button>
      ) : null}
    </>
  )
}
```

Notes:
- Use action `type`s that describe what happened, and keep them stable: they are now public API.
- The `useRef` keeps the initial state stable so `reset` returns to the value from mount, not from the latest props (that is the "state initializer" pattern).
- If consumers also need to own the state itself, add control props on top: `control-props.md`.
