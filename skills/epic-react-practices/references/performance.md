# Performance

Read this when something is slow, or before adding `useMemo`, `useCallback` or `memo`.

Contents:
1. Measure first
2. Colocate state
3. Lift content up (element optimization)
4. Code splitting with preloading
5. Expensive calculations: `useMemo` and web workers
6. `memo` done right
7. Context performance
8. Long lists: virtualization
9. React Compiler

Measure first, then work through cheap fixes, in roughly this order:

1. colocate state so updates touch less of the tree,
2. lift content up / pass `children` so expensive subtrees don't re-render when their parent's state changes,
3. code-split heavy, rarely needed UI with `lazy` + `Suspense` and preload it on intent (hover/focus),
4. `useMemo` for measured expensive calculations; move very heavy work to a web worker,
5. `memo` for expensive components that re-render often with the same props (and keep those props stable: primitives, memoized callbacks),
6. virtualize long lists (e.g. TanStack Virtual).

The order matters: each step is cheaper and less invasive than the next. Don't skip to `memo` and `useCallback` everywhere: they are not free and make code harder to read. Use them for measured expensive work or for referential stability that matters (dependency arrays, props to `memo` components, context values), not by default.

---

## 1. Measure first

- Reproduce the slowness with a **production build** (or a profiling build). Development mode is much slower and misleading.
- Record with the **React DevTools Profiler** (enable "Record why each component rendered") to see which components render, how long they take and why.
- Use the browser Performance panel for long tasks, layout thrashing and non-React work. Throttle the CPU to approximate slower devices.
- Write down the number you're trying to improve (interaction latency, commit duration) and check it again after each change. Keep changes that measurably help; revert the ones that don't.
- **Fix the slow render before the re-render.** A component that renders in 0.1ms can re-render many times without anyone noticing. Find what is slow inside a render (a big computation, a huge tree) before reducing render counts.

---

## 2. Colocate state

State that lives high in the tree re-renders everything below it on every change. Moving it down to where it's used is often the biggest, simplest win.

```tsx
// Before: typing re-renders the whole page, including the expensive chart
function Dashboard() {
  const [search, setSearch] = useState('')
  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <FilteredList search={search} />
      <ExpensiveChart />
    </>
  )
}

// After: search state lives with the components that use it
function Dashboard() {
  return (
    <>
      <SearchableList />
      <ExpensiveChart />
    </>
  )
}

function SearchableList() {
  const [search, setSearch] = useState('')
  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <FilteredList search={search} />
    </>
  )
}
```

---

## 3. Lift content up (element optimization)

When a component with frequently changing state renders an expensive subtree that doesn't depend on that state, pass the subtree in as `children` (or another element prop). React skips re-rendering an element that is the same object as last time, and elements created by the parent don't change when the child's state does.

```tsx
// Before: every scroll update re-renders <ExpensiveContent />
function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  return (
    <div onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}>
      <ProgressBar value={scrollY} />
      <ExpensiveContent />
    </div>
  )
}

// After: <ExpensiveContent /> is created by the parent and reused
function ScrollTracker({ children }: { children: React.ReactNode }) {
  const [scrollY, setScrollY] = useState(0)
  return (
    <div onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}>
      <ProgressBar value={scrollY} />
      {children}
    </div>
  )
}

function Page() {
  return (
    <ScrollTracker>
      <ExpensiveContent />
    </ScrollTracker>
  )
}
```

No memoization APIs needed.

---

## 4. Code splitting with preloading

Split heavy, rarely needed UI (charts, editors, maps, admin screens) out of the main bundle. Most routers already split per route; this is for heavy pieces inside a route.

```tsx
import { lazy, Suspense, useState } from 'react'

const loadGlobe = () => import('./globe')
const Globe = lazy(loadGlobe)

function GlobeToggle() {
  const [showGlobe, setShowGlobe] = useState(false)
  return (
    <>
      <label onPointerEnter={loadGlobe} onFocus={loadGlobe}>
        <input type="checkbox" checked={showGlobe} onChange={(e) => setShowGlobe(e.target.checked)} />
        Show globe
      </label>
      {showGlobe ? (
        <Suspense fallback={<p>Loading globe...</p>}>
          <Globe />
        </Suspense>
      ) : null}
    </>
  )
}
```

- Calling `loadGlobe()` on hover/focus starts the download when the user shows intent, so the code is usually ready by the time they click. `import()` is cached by the bundler, so calling it repeatedly is cheap.
- Pair `lazy` components with an error boundary; chunk loading can fail (deploys, flaky networks).
- Use the bundler's analyzer to find what is actually large before splitting.

---

## 5. Expensive calculations

`useMemo` caches a value between renders until its dependencies change. Use it when a calculation is measurably expensive (as a rough guide, more than about a millisecond on a throttled CPU) and its inputs change less often than the component renders.

```tsx
function CityList({ cities, filter }: { cities: City[]; filter: string }) {
  const matchingCities = useMemo(() => searchCities(cities, filter), [cities, filter])
  return <ul>{matchingCities.map((city) => <li key={city.id}>{city.name}</li>)}</ul>
}
```

- Memoization only helps if the dependencies are stable. A new `cities` array every render means the memo never hits.
- Not worth it for cheap work like mapping a short array or concatenating strings.
- If a calculation is so heavy that even one run blocks the main thread (large parsing, sorting tens of thousands of items, image work), move it to a **web worker** (a library like Comlink keeps the API ergonomic) and treat the result as async data, which pairs nicely with Suspense.

---

## 6. `memo` done right

`memo` makes a component skip rendering when its props are shallowly equal to last time. It's worth it when a component is expensive and its parent re-renders often with the same props.

```tsx
const ListItem = memo(function ListItem({
  item,
  isSelected,
  isHighlighted,
  onSelect,
}: {
  item: Item
  isSelected: boolean
  isHighlighted: boolean
  onSelect: (id: string) => void
}) {
  return (
    <li aria-selected={isSelected} data-highlighted={isHighlighted || undefined} onClick={() => onSelect(item.id)}>
      {item.label}
    </li>
  )
})

function List({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const handleSelect = useCallback((id: string) => setSelectedId(id), [])

  return (
    <ul>
      {items.map((item, index) => (
        <ListItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedId}
          isHighlighted={index === highlightedIndex}
          onSelect={handleSelect}
        />
      ))}
    </ul>
  )
}
```

Things that defeat `memo`:
- passing a new object, array or inline function on every render (stabilize them, or pass primitives),
- passing the whole changing value (`selectedId`, `highlightedIndex`) to every item instead of computing a per-item boolean in the parent; with booleans, only the two items whose value changed re-render,
- passing `children` elements, which are new objects each render.

Avoid custom comparison functions unless you're certain they're correct; a wrong comparator causes stale UI that's hard to debug.

---

## 7. Context performance

Every consumer re-renders when the context value changes identity.

- If the provider re-renders for reasons unrelated to the value, memoize the value:

```tsx
function CountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)
  const value = useMemo(() => ({ count, setCount }), [count])
  return <CountContext value={value}>{children}</CountContext>
}
```

- If many components only need the updater, split state and dispatch into two contexts so updater-only consumers never re-render.
- If a context holds unrelated pieces of state, split it into several contexts, or colocate the state that only a few components need.
- For high-frequency global state (cursor positions, large stores), consider an external store with selectors via `useSyncExternalStore` (or a library built on it) so components subscribe only to the slice they use.

---

## 8. Long lists: virtualization

Rendering thousands of rows is slow no matter how fast each row is. Render only what's visible with a virtualizer (e.g. `@tanstack/react-virtual`). Virtualization affects find-in-page, scroll restoration and accessibility, so prefer pagination or "load more" when that fits the UX, and virtualize when the list really must be long.

---

## 9. React Compiler

If the project uses the React Compiler, it memoizes components, values and callbacks automatically.

- Don't add `useMemo`, `useCallback` or `memo` by default; it's noise. Only add it where profiling shows the compiler missed a hot spot.
- The compiler relies on code following the rules of React (pure render, no mutation of props/state, rules of hooks). Breaking those rules makes it skip a component, so the `react-hooks` / compiler lint rules matter more, not less.
- Steps 1 to 4 and 8 above (measure, colocate, lift content, code split, virtualize) still apply; the compiler doesn't make slow renders fast or bundles small.
