# Slots

**Use when** you have generic building blocks (`Label`, `Input`, `Description`, `ErrorMessage`) that should get the right props (ids, `htmlFor`, `aria-describedby`) based on the parent they're placed in, without being tied to one specific parent. A `TextField`, `Checkbox` and `Switch` can all reuse the same `Label`.

```tsx
import { createContext, use, useId } from 'react'

type SlotProps = Record<string, Record<string, unknown>>
const SlotContext = createContext<SlotProps>({})

function useSlotProps<Props extends { slot?: string }>(props: Props, defaultSlot: string): Props {
  const slot = props.slot ?? defaultSlot
  const slots = use(SlotContext)
  // slot-provided props first, so explicit props from the consumer win
  return { ...(slots[slot] as Partial<Props>), ...props, slot }
}

export function Label(props: React.ComponentProps<'label'> & { slot?: string }) {
  const { slot: _slot, ...labelProps } = useSlotProps(props, 'label')
  return <label {...labelProps} />
}

export function Input(props: React.ComponentProps<'input'> & { slot?: string }) {
  const { slot: _slot, ...inputProps } = useSlotProps(props, 'input')
  return <input {...inputProps} />
}

export function Description(props: React.ComponentProps<'p'> & { slot?: string }) {
  const { slot: _slot, ...descriptionProps } = useSlotProps(props, 'description')
  return <p {...descriptionProps} />
}

export function TextField({ id, children }: { id?: string; children: React.ReactNode }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`

  const slots: SlotProps = {
    label: { htmlFor: inputId },
    input: { id: inputId, 'aria-describedby': descriptionId },
    description: { id: descriptionId },
  }

  return <SlotContext value={slots}>{children}</SlotContext>
}
```

Usage:

```tsx
<TextField>
  <Label>Email</Label>
  <Input type="email" name="email" />
  <Description>We'll never share it.</Description>
</TextField>
```

Consumers get correct accessibility wiring without passing ids around, and can still override any prop.

Code targets React 19 (`<Context value>`, `use(Context)`); on React 18, use `<Context.Provider value>` and `useContext`.
