import { useState } from 'react'
import { lastFourOf } from '~shared/validation/bankAccount'

import { Button } from '../form/Button'
import { Field, Line } from '../form/Field'

// Offered where it is needed, not on another screen. Sending him elsewhere mid-sitting means retyping the payment when he comes back, which is the friction that ends with Excel reopened.
export function AddAnAccount({ onAdd }: { onAdd: (label: string, lastFourDigits: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-primary self-start pt-1 text-sm font-medium">
        Add an account
      </button>
    )
  }

  async function save() {
    setSaving(true)
    setProblem(null)

    // The last four digits are taken here, on the device, so the rest of the number never crosses the wire.
    const kept = lastFourOf.safeParse(number)
    if (!kept.success) {
      setProblem(kept.error.issues[0]?.message ?? 'Put in the account number.')
      setSaving(false)
      return
    }

    try {
      await onAdd(label, kept.data)
      setOpen(false)
      setLabel('')
      setNumber('')
    } catch (thrown) {
      setProblem(thrown instanceof Error ? thrown.message : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-border mt-2 flex flex-col gap-4 border-l-2 pl-4">
      {/* Both of these were a `<label>` and an upper-case span written out by hand, which is `Field` copied rather than used -- and the copy is what drifts. */}
      <Field label="What you call it">
        <Line
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Bank 0000"
          autoComplete="off"
        />
      </Field>

      {/* True end to end: the rest is dropped here, before anything is sent. */}
      <Field label="Account number" hint="Only the last four figures leave this phone.">
        <Line
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
        />
      </Field>

      {problem ? <span className="text-destructive text-sm">{problem}</span> : null}

      <div className="flex gap-3">
        <Button look="beside" onClick={() => setOpen(false)} className="text-muted-foreground flex-1 py-2 text-sm">
          Never mind
        </Button>
        <Button onClick={save} busy={saving} className="flex-1 py-2 text-sm">
          Save it
        </Button>
      </div>
    </div>
  )
}
