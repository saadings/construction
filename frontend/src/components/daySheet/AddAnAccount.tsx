import { useState } from 'react'
import { lastFourOf } from '~shared/validation/bankAccount'

import { Line } from '../form/Field'

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
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">
          What you call it
        </span>
        <Line
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Bank 0000"
          aria-label="What you call it"
          autoComplete="off"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">
          Account number
        </span>
        <Line
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          inputMode="numeric"
          aria-label="Account number"
          autoComplete="off"
        />
        {/* True end to end: the rest is dropped here, before anything is sent. */}
        <span className="text-muted-foreground text-sm">Only the last four figures leave this phone.</span>
      </label>

      {problem ? <span className="text-destructive text-sm">{problem}</span> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-border text-muted-foreground flex-1 rounded-md border py-2 text-sm"
        >
          Never mind
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground flex-1 rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save it'}
        </button>
      </div>
    </div>
  )
}
