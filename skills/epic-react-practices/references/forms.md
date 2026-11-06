# Forms

Read this when building a form, a form action, or pending and optimistic UI for a submission.

If the project's framework provides its own form or mutation primitives (router actions, server actions, a form library), use them; the principles below still apply.

## Basics

- Use a real `<form>` with `onSubmit` (or a React 19 form `action`) and read values with `FormData` / `name` attributes.
- Make inputs uncontrolled (`defaultValue`) unless you need the value on every keystroke (live validation, dependent fields, formatting).
- Every input gets a label (`<label htmlFor>` with `useId()` for the id, or a wrapping `<label>`).
- Show validation errors next to their field and connect them with `aria-invalid` and `aria-describedby`.

## React 19 form actions

Form actions handle pending state, errors and resets without manual `isSubmitting` booleans: form `action`s, `useActionState` for result/pending state, `useFormStatus` inside the form for pending UI, and `useOptimistic` for instant feedback that rolls back on failure.

```tsx
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

type FormState = { status: 'idle' } | { status: 'error'; message: string } | { status: 'success' }

function SubmitButton() {
  // must be rendered inside the <form>
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>
}

export function ProfileForm({ user }: { user: User }) {
  const [state, formAction] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const result = await updateProfile({ name: String(formData.get('name') ?? '') })
    return result.ok ? { status: 'success' } : { status: 'error', message: result.message }
  }, { status: 'idle' })

  return (
    <form action={formAction}>
      <label htmlFor="name">Name</label>
      <input
        id="name"
        name="name"
        defaultValue={user.name}
        aria-invalid={state.status === 'error' || undefined}
        aria-describedby={state.status === 'error' ? 'name-error' : undefined}
      />
      {state.status === 'error' ? <p id="name-error" role="alert">{state.message}</p> : null}
      <SubmitButton />
    </form>
  )
}
```

## Optimistic UI

`useOptimistic` shows the expected result immediately and falls back to the real state when the action finishes or fails:

```tsx
import { useOptimistic, startTransition } from 'react'

function LikeButton({ liked, onToggleLike }: { liked: boolean; onToggleLike: () => Promise<void> }) {
  const [optimisticLiked, setOptimisticLiked] = useOptimistic(liked)

  return (
    <button
      aria-pressed={optimisticLiked}
      onClick={() => {
        startTransition(async () => {
          setOptimisticLiked(!optimisticLiked)
          await onToggleLike()
        })
      }}
    >
      {optimisticLiked ? 'Unlike' : 'Like'}
    </button>
  )
}
```

Optimistic updates must be set inside a transition or action. If the action throws, the optimistic value reverts; make sure the error is surfaced to the user too.

After a submission changes what's on screen, move focus somewhere sensible (see "Accessibility and focus" in `components.md`).
