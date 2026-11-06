# Data loading, Suspense and transitions

Read this when loading data, using Suspense or `use()`, keeping the UI responsive with transitions or `useDeferredValue`, or avoiding request waterfalls.

## Contents

1. Data fetching: pick the right layer
2. Suspense with `use()` and a promise cache
3. Transitions and pending UI
4. Avoiding waterfalls (preloading and parallel requests)
5. `useDeferredValue`
6. A correct manual fetch effect (when nothing else is available)

If the project uses a framework or data library (React Router loaders, Next.js server components, TanStack Query, SWR, Relay), use its primitives for loading, caching and errors. The patterns here explain the underlying ideas and cover projects without such a layer. Errors while loading are caught by error boundaries: see `error-boundaries.md`.

---

## 1. Data fetching: pick the right layer

In order of preference:

1. The framework's data primitive (route loaders/actions, server components).
2. A server-state library (TanStack Query, SWR) for client-side fetching with caching, dedupe, retries and invalidation.
3. `use()` with a small promise cache, for simple cases or teaching code.
4. A manual effect (section 6), only when none of the above is available.

Whatever you choose, the UI must handle all four states (idle/pending/success/error), and requests must not race.

---

## 2. Suspense with `use()` and a promise cache

`use(promise)` suspends the component until the promise settles: the nearest `<Suspense>` shows its fallback while pending, and the nearest error boundary catches a rejection.

The promise must be stable across renders. Creating it during render (`use(fetchShip(name))`) makes a new promise every render and loops forever. Cache it (or get it from a framework loader):

```tsx
import { Suspense, use } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

const shipCache = new Map<string, Promise<Ship>>()

export function getShip(name: string) {
  let promise = shipCache.get(name)
  if (!promise) {
    promise = fetchShip(name)
    shipCache.set(name, promise)
  }
  return promise
}

function ShipDetails({ name }: { name: string }) {
  const ship = use(getShip(name))
  return (
    <section>
      <h2>{ship.name}</h2>
      <p>Top speed: {ship.topSpeed}</p>
    </section>
  )
}

export function ShipView({ name }: { name: string }) {
  return (
    <ErrorBoundary fallback={<p role="alert">Couldn't load {name}.</p>} resetKeys={[name]}>
      <Suspense fallback={<p>Loading {name}...</p>}>
        <ShipDetails name={name} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

- Decide what happens to rejected promises in the cache (delete the entry in a `.catch` so a retry refetches) and when entries expire. If this gets complicated, that's the signal to use a data library.
- Place Suspense boundaries where a loading state makes sense to a user. Too high and the whole page flashes; too low and the page fills with spinners. Nest them so fast content shows while slow content loads.
- Suspense fallbacks can be skeletons with the same layout as the content, which avoids layout shift.
- `use()` can also read context, and unlike other hooks it can be called conditionally.

---

## 3. Transitions and pending UI

When the input to a suspending component changes, React would normally replace already-visible content with the fallback. Wrapping the update in a transition (`useTransition` / `startTransition`) keeps the old content on screen, with a pending indicator, until the new content is ready:

```tsx
import { useState, useTransition } from 'react'

function ShipBrowser() {
  const [shipName, setShipName] = useState('Dreadnought')
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <ShipButtons
        onSelect={(name) => {
          startTransition(() => {
            setShipName(name)
          })
        }}
      />
      <div style={{ opacity: isPending ? 0.6 : 1 }} aria-busy={isPending}>
        <ShipView name={shipName} />
      </div>
    </>
  )
}
```

- Show a subtle pending indicator (dimming, a small spinner) using `isPending`.
- Only non-urgent updates belong in transitions. Typing into an input must stay urgent; see `useDeferredValue` below.
- Async functions can be passed to `startTransition` in React 19; `isPending` stays true until they finish.

---

## 4. Avoiding waterfalls

A waterfall happens when request B can't start until request A finishes, usually because B's component only renders after A's data arrives.

- Start requests as early as you know you need them: in the event handler that causes navigation, in a route loader, or in a parent that renders all the suspending children.
- Fire independent requests together. Kick off both promises first, then read them, instead of awaiting one before starting the other:

```tsx
function ShipPage({ name }: { name: string }) {
  // both requests start now, in parallel
  const shipPromise = getShip(name)
  const crewPromise = getCrew(name)
  return (
    <>
      <ShipDetails shipPromise={shipPromise} />
      <Suspense fallback={<CrewSkeleton />}>
        <CrewList crewPromise={crewPromise} />
      </Suspense>
    </>
  )
}
```

(Here `getShip`/`getCrew` return cached promises, so calling them during render is safe, and `ShipDetails`/`CrewList` are variants that receive the promise and call `use()` on it.)

- Preload on intent: call `getShip(name)` on `pointerenter`/`focus` of a link so the data is often ready by the time the user clicks.
- Preload images that the next view needs, and lazy components (see "Code splitting with preloading" in `performance.md`), with the same trick.

---

## 5. `useDeferredValue`

Keep an input responsive while expensive or suspending results update behind it:

```tsx
function SearchPage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  return (
    <>
      <label>
        Search
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div style={{ opacity: isStale ? 0.6 : 1 }}>
        <Suspense fallback={<p>Searching...</p>}>
          <SearchResults query={deferredQuery} />
        </Suspense>
      </div>
    </>
  )
}
```

The input renders with the new value immediately; the results render with the deferred value when React has time, and show the previous results (dimmed) instead of a fallback while the new ones load.

---

## 6. A correct manual fetch effect

Only when there's no data layer and Suspense isn't an option. Note the single status union, the abort on cleanup, and ignoring the abort error:

```tsx
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'resolved'; data: T }
  | { status: 'rejected'; error: Error }

function useUser(userId: string | null) {
  const [state, setState] = useState<AsyncState<User>>({ status: 'idle' })

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    setState({ status: 'pending' })

    fetchUser(userId, { signal: controller.signal }).then(
      (data) => setState({ status: 'resolved', data }),
      (error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'rejected', error: error instanceof Error ? error : new Error(String(error)) })
      },
    )

    return () => controller.abort()
  }, [userId])

  return state
}
```

The consumer then switches on `state.status`, and TypeScript guarantees `data` only exists in the resolved branch. Once more than one component needs this data, or you need caching or refetching, move to a data library instead of growing this hook.
