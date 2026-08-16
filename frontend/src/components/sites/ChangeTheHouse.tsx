import { useState } from 'react'

import { Button } from '../form/Button'
import { StillSending } from '../form/StillSending'
import { WayOut } from '../form/WayOut'
import { whatWentWrong } from '../form/whatWentWrong'
import type { HouseAsSent, HouseAsTyped } from './HouseDetails'
import { HouseDetails } from './HouseDetails'

// Nauman's one house in production is called "Test Site", made while somebody was diagnosing a spinner. Without this his real first house sits under a test one forever.

// Two ways out on one screen, and `Cancel` on both would mean opposite things: one abandons the edit, the other keeps a house that was about to be archived. The contract screen was ruled the same way -- the form's back-out is `Discard` and the confirmation's is `Cancel` -- and this screen has the same pair.
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
      <Button
        look="another"
        className="self-start"
        onClick={() => {
          setOpen(true)
        }}
      >
        Edit house
      </Button>
    )
  }

  return (
    <div className="border-border flex flex-col gap-5 rounded-md border p-4">
      <HouseDetails
        // Keyed on what it opened holding, so a house corrected elsewhere is not shown stale under somebody's hands.
        key={house.name}
        house={house}
        saying="Save"
        onSave={async (corrected) => {
          await onSave(corrected)
          setOpen(false)
        }}
        beneath={<PutItAway onPutAway={onPutAway} />}
      />

      <WayOut
        className="self-start"
        onClick={() => {
          setOpen(false)
        }}
      >
        Discard
      </WayOut>
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
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-hairline flex flex-col gap-2 border-t pt-5">
      <p className="text-muted-foreground text-sm">
        A house put away comes off the list. What was spent on it is still there, and every payment still points at it.
      </p>

      <StillSending busy={saving} />
      {refusal === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {refusal}
        </p>
      )}

      {sure ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button look="beside" onClick={putAway} busy={saving} className="py-2 text-sm">
            Yes, archive
          </Button>
          <WayOut
            onClick={() => {
              setSure(false)
            }}
          >
            Cancel
          </WayOut>
        </div>
      ) : (
        <WayOut
          className="self-start"
          onClick={() => {
            setSure(true)
          }}
        >
          Archive
        </WayOut>
      )}
    </div>
  )
}
