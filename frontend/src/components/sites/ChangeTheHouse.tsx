import { useState } from 'react'

import { Button } from '../form/Button'
import type { HouseAsSent, HouseAsTyped } from './HouseDetails'
import { HouseDetails } from './HouseDetails'

// Nauman's one house in production is called "Test Site", made while somebody was diagnosing a spinner. Without this his real first house sits under a test one forever.

export function ChangeTheHouse({
  house,
  onSave,
  onPutAway,
}: {
  house: HouseAsTyped
  onSave: (house: HouseAsSent) => Promise<void>
  onPutAway: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="text-primary self-start text-sm font-medium"
      >
        Change this house
      </button>
    )
  }

  return (
    <div className="border-border flex flex-col gap-5 rounded-md border p-4">
      <HouseDetails
        // Keyed on what it opened holding, so a house corrected elsewhere is not shown stale under somebody's hands.
        key={house.name}
        house={house}
        saying="Save it"
        onSave={async (corrected) => {
          await onSave(corrected)
          setOpen(false)
        }}
        beneath={<PutItAway onPutAway={onPutAway} />}
      />

      <button
        type="button"
        onClick={() => {
          setOpen(false)
        }}
        className="text-muted-foreground self-start text-sm underline underline-offset-4"
      >
        Leave it as it is
      </button>
    </div>
  )
}

// Put away, never deleted: every payment, receipt and contract points at a house forever, and one that vanishes turns all of them into money spent on nothing.
function PutItAway({ onPutAway }: { onPutAway: () => Promise<void> }) {
  const [sure, setSure] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function putAway() {
    setSaving(true)
    setRefusal(null)

    try {
      await onPutAway()
    } catch (thrown) {
      const said: unknown = (thrown as { data?: unknown }).data
      setRefusal(typeof said === 'string' && said !== '' ? said : 'That did not go in. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-hairline flex flex-col gap-2 border-t pt-5">
      <p className="text-muted-foreground text-sm">
        A house put away comes off the list. What was spent on it is still there, and every payment still points at it.
      </p>

      {refusal === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {refusal}
        </p>
      )}

      {sure ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button look="beside" onClick={putAway} busy={saving} className="py-2 text-sm">
            Yes, put it away
          </Button>
          <button
            type="button"
            onClick={() => {
              setSure(false)
            }}
            className="text-muted-foreground text-sm underline underline-offset-4"
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSure(true)
          }}
          className="text-destructive self-start text-sm font-medium"
        >
          Put this house away
        </button>
      )}
    </div>
  )
}
