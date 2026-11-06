# Effects and custom hooks

Read this when writing an effect or a custom hook, subscribing to an external store, or when an effect or callback needs the latest value of a prop.

## Contents

- When you need an effect
- Writing an effect
- Custom hooks
- Latest ref and `useEffectEvent`

## When you need an effect

An effect synchronizes your component with something **outside React**: a subscription, a timer, a browser API, a third-party widget, a network connection. If there is no external system involved, you almost certainly don't need an effect.

Do not use an effect to:

- compute derived data (compute it in render),
- respond to a user action (do it in the event handler; you know exactly what happened there),
- reset state when a prop changes (use `key`, or adjust state during render),
- notify a parent of a change (call the parent's callback in the same event handler that changed the state),
- chain state updates that trigger each other.

Fetching data in an effect is the last resort; see `data-and-suspense.md` for the data-layer options and a correct manual fetch effect.

## Writing an effect

- **Always clean up.** Unsubscribe, clear timers, remove listeners (an `AbortController` whose `signal` is passed to `addEventListener` and `fetch` cleans up several things at once).
- **Handle races** when fetching: abort or ignore results from stale requests.
- **Keep dependencies honest.** Follow `react-hooks/exhaustive-deps`; never silence it. If the dependency list causes trouble, change the code: move the function inside the effect, depend on primitives instead of objects, or read the latest value of a callback through `useEffectEvent` (React 19.2+) or the latest-ref pattern (below).
- Use `useLayoutEffect` only when you must measure or mutate the DOM before the browser paints (e.g. positioning a tooltip). Everything else uses `useEffect`.
- Subscribing to an external store (browser APIs like `matchMedia`, a non-React store)? Use `useSyncExternalStore` instead of `useState` + `useEffect`.

## Custom hooks

- Extract a custom hook when logic is reused, or when naming a concept makes a component easier to read. Don't extract just to shorten a file.
- A hook is a function that calls hooks; name it `useSomething`. If it doesn't call hooks, make it a regular function.
- Functions returned from a reusable hook should be stable (`useCallback`) because consumers may put them in dependency arrays. Objects returned for the same reason may need `useMemo`.
- Test a hook through a component that uses it; see `testing.md`.

## Latest ref and `useEffectEvent`

**Use when** an effect, a debounced/throttled function or a subscription needs to call the *latest* version of a callback or read the latest prop, but should not re-run or be recreated every time that value changes.

On React 19.2+, prefer `useEffectEvent` for the effect case:

```tsx
function ChatRoom({ roomId, onMessage }: { roomId: string; onMessage: (m: Message) => void }) {
  const handleMessage = useEffectEvent((m: Message) => onMessage(m))

  useEffect(() => {
    const connection = connect(roomId)
    connection.on('message', handleMessage)
    return () => connection.disconnect()
  }, [roomId]) // handleMessage is not a dependency
}
```

For other cases (or older React), use a latest ref. Update the ref in a layout effect, not during render, so render stays pure and concurrent renders that get thrown away don't leak values:

```tsx
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

function useDebounce<Args extends unknown[]>(callback: (...args: Args) => void, delay: number) {
  const latestCallback = useLatest(callback)

  return useMemo(
    () => debounce((...args: Args) => latestCallback.current(...args), delay),
    [delay, latestCallback],
  )
}

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return (...args: Args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
```

The debounced function is created once per `delay`, yet always calls the newest callback, so consumers don't need `useCallback` for it to work.

**Trade-off:** the callback is read when it's called, not when the effect was set up. That's what you want for event-like callbacks; it's wrong for values that should be captured at a point in time.
