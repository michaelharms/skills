# Testing React code

Read this when writing or reviewing tests for React code.

Contents:
1. What to test and at which level
2. Query priority
3. Interacting: user-event
4. Async: `findBy`, `waitFor`
5. Mocking the network with MSW
6. Structure: setup functions instead of nested hooks
7. Testing custom hooks
8. Example integration test
9. Common mistakes
10. End-to-end tests

Assumes Testing Library (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`) with Vitest or Jest. Follow the project's existing setup if it differs.

---

## 1. What to test and at which level

The aim of a test is confidence that the software works for the people who use it. Two kinds of "users" matter: the end user, who sees the screen, and the developer, who renders your component with props. A test should act like one of them. If a test has to reach into internals that neither of them touch, it becomes a third user you have to keep happy, and it will break on refactors that don't change behavior.

Implementation details to avoid testing:
- component state and instance methods,
- which hooks were called or how often a component rendered,
- private helper functions inside a module,
- CSS class names and DOM structure that users don't perceive,
- child components rendered (avoid shallow rendering).

The testing trophy, from cheapest to most confident:
- **Static analysis**: TypeScript, ESLint (`react-hooks`, `jsx-a11y`, `testing-library`, `jest-dom` plugins). Catches typos and type errors for free.
- **Unit tests**: pure functions with real logic (reducers, formatters, validation).
- **Integration tests**: render a feature with its real children and real hooks, mock only the network. Most of the testing effort goes here.
- **End-to-end tests**: a handful of critical user journeys in a real browser.

Use code coverage to find untested *use cases*, not as a target to hit.

---

## 2. Query priority

Pick the first query that works, in this order:

1. `getByRole` with an accessible name: `getByRole('button', { name: /save/i })`, `getByRole('heading', { name: /settings/i })`, `getByRole('checkbox', { name: /remember me/i })`
2. `getByLabelText` for form fields
3. `getByPlaceholderText` (only if there's no label, which is itself an accessibility issue)
4. `getByText` for non-interactive content
5. `getByDisplayValue` for filled-in form fields
6. `getByAltText`, `getByTitle`
7. `getByTestId` as a last resort, for things users really can't perceive

If you can't find an element by role and name, that's often an accessibility bug in the component; fix the component rather than the query.

Always use `screen` instead of destructuring queries from `render`.

Query variants:
- `getBy*` when the element should be there now (throws a helpful error otherwise),
- `findBy*` when it will appear asynchronously (returns a promise),
- `queryBy*` only to assert that something is **not** there: `expect(screen.queryByRole('alert')).not.toBeInTheDocument()`.

Use `jest-dom` matchers for readable assertions and better failure messages: `toBeInTheDocument`, `toBeDisabled`, `toHaveValue`, `toHaveAccessibleName`, `toHaveAttribute`, `toBeChecked`, `toHaveTextContent`.

---

## 3. Interacting: user-event

`user-event` simulates real interactions (focus, pointer events, keyboard events, typing character by character), while `fireEvent` only dispatches single DOM events.

```tsx
import userEvent from '@testing-library/user-event'

test('...', async () => {
  const user = userEvent.setup()
  render(<LoginForm onSubmit={handleSubmit} />)

  await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
})
```

- Call `userEvent.setup()` before rendering, once per test.
- Always `await` user-event calls.
- Use `user.keyboard('{Enter}')`, `user.tab()` to test keyboard support.

---

## 4. Async: `findBy`, `waitFor`

- Prefer `await screen.findByRole(...)` for things that appear after loading.
- Use `waitFor` for assertions that eventually become true and can't be expressed with `findBy`. Put a single assertion inside, no side effects (no clicks or typing), and never an empty callback.
- Use `waitForElementToBeRemoved` when waiting for a loading indicator to disappear.
- Don't wrap `render` or user-event calls in `act`; Testing Library already does. An "not wrapped in act" warning usually means the test finished before an async update happened: await the UI result of that update.
- Use fake timers only when the test is genuinely about time (debounce, timeouts), and configure user-event with `advanceTimers`.

---

## 5. Mocking the network with MSW

Mock HTTP, not your modules. That way the component's real fetching code, data library and error handling all run.

```ts
// test/server.ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const handlers = [
  http.get('/api/users/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Ada Lovelace' }),
  ),
  http.post('/api/users/:id', async ({ request }) => {
    const body = (await request.json()) as { name: string }
    return HttpResponse.json({ id: '1', name: body.name })
  }),
]

export const server = setupServer(...handlers)
```

```ts
// test/setup.ts
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

Override per test for error cases:

```ts
server.use(
  http.get('/api/users/:id', () => HttpResponse.json({ message: 'Not found' }, { status: 404 })),
)
```

The same handlers can power the dev server and Storybook, so mocks stay consistent.

---

## 6. Structure: setup functions instead of nested hooks

Deeply nested `describe` blocks with `beforeEach` that assign shared `let` variables make tests hard to read: to understand one test you have to read the whole file. Prefer flat tests and a setup function that returns what the test needs:

```tsx
function setup(overrides: Partial<React.ComponentProps<typeof ProfileForm>> = {}) {
  const user = userEvent.setup()
  const onSave = vi.fn()
  render(<ProfileForm user={{ id: '1', name: 'Ada' }} onSave={onSave} {...overrides} />)
  return { user, onSave }
}

test('saves the new name', async () => {
  const { user, onSave } = setup()
  // ...
})
```

Each test reads top to bottom. It's fine for tests to repeat a little; clarity beats DRY in tests.

Write fewer, longer tests that follow a realistic flow (fill in form, submit, see result) rather than one assertion per test with repeated setup. A test is a use case, not a single assertion.

---

## 7. Testing custom hooks

- Hooks used by one component: test them through that component.
- Reusable hooks (a shared library): render a small test component that uses the hook the way a consumer would, or use `renderHook` from `@testing-library/react` and interact with `result.current` inside `act`.

```tsx
import { act, renderHook } from '@testing-library/react'

test('toggles and resets', () => {
  const { result } = renderHook(() => useToggle({ initialOn: true }))
  expect(result.current.on).toBe(true)

  act(() => result.current.toggle())
  expect(result.current.on).toBe(false)

  act(() => result.current.reset())
  expect(result.current.on).toBe(true)
})
```

---

## 8. Example integration test

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { EditProfile } from './edit-profile'

test('a user can update their name', async () => {
  const user = userEvent.setup()
  render(<EditProfile userId="1" />)

  const nameInput = await screen.findByLabelText(/name/i)
  expect(nameInput).toHaveValue('Ada Lovelace')

  await user.clear(nameInput)
  await user.type(nameInput, 'Ada King')
  await user.click(screen.getByRole('button', { name: /save/i }))

  expect(await screen.findByRole('status')).toHaveTextContent(/saved/i)
})

test('shows the server error when saving fails', async () => {
  server.use(
    http.post('/api/users/:id', () =>
      HttpResponse.json({ message: 'Name is already taken' }, { status: 400 }),
    ),
  )
  const user = userEvent.setup()
  render(<EditProfile userId="1" />)

  await user.click(await screen.findByRole('button', { name: /save/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/already taken/i)
  expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'true')
})
```

Note what's not here: no mocked hooks, no inspecting state, no snapshot of the DOM.

---

## 9. Common mistakes

- Using `container.querySelector` or class names instead of accessible queries.
- Calling `cleanup` manually (it runs automatically).
- Using `getBy*` to assert absence, or `queryBy*` to assert presence.
- `waitFor` with side effects inside, multiple assertions inside, or an empty callback.
- Wrapping things in `act` unnecessarily, or silencing act warnings instead of awaiting the real result.
- `fireEvent` where user-event would better reflect reality.
- Large DOM snapshots that nobody reviews; prefer explicit assertions (small inline snapshots of formatted output are fine).
- Mocking child components or hooks so that the test no longer exercises real integration.
- Testing third-party libraries instead of your use of them.

---

## 10. End-to-end tests

Use Playwright for a few critical journeys (sign up, checkout, the core workflow). Apply the same principles: locate elements by role and accessible name (`page.getByRole('button', { name: 'Save' })`), rely on auto-waiting assertions (`await expect(locator).toBeVisible()`), and keep each test independent with its own data setup. Don't duplicate every integration test as an E2E test.
