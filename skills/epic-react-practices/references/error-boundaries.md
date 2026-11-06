# Error boundaries and errors

Read this when handling errors in React UI: placing error boundaries, recovering from errors, and errors from event handlers or async code.

Wrap features (not just the whole app) in **error boundaries** so one failure doesn't blank the page. Use `react-error-boundary` rather than hand-writing class components.

```tsx
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong loading this section.</p>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

function ProfilePage({ userId }: { userId: string }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[userId]}>
      <UserProfile userId={userId} />
    </ErrorBoundary>
  )
}
```

- Put boundaries around independent features (a widget, a panel, a route) so one failure leaves the rest usable. Keep an outer boundary near the root as a last line of defense.
- Give the fallback a way to recover (`resetErrorBoundary`). `resetKeys` resets the boundary when the input that caused the error changes, e.g. navigating to another user after an error.
- Use `onReset` to clear whatever state caused the error, and `onError` to report to your logging service.
- Boundaries catch errors thrown during render, in lifecycle code and in effects. They do **not** catch errors from event handlers, `setTimeout` callbacks or promises you handle yourself. For those, either show the error locally or send it to the nearest boundary with `showBoundary`:

```tsx
import { useErrorBoundary } from 'react-error-boundary'

function DeleteButton({ id }: { id: string }) {
  const { showBoundary } = useErrorBoundary()
  return (
    <button
      onClick={async () => {
        try {
          await deleteItem(id)
        } catch (error) {
          showBoundary(error)
        }
      }}
    >
      Delete
    </button>
  )
}
```

- Pair `lazy` components with an error boundary; chunk loading can fail (deploys, flaky networks).
- Suspending components need both a `<Suspense>` boundary for loading and an error boundary for failures; see `data-and-suspense.md`.
