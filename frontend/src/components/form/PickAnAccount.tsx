import { useEffect, useRef, useState } from 'react'
import { lastFourOf } from '~shared/validation/bankAccount'

import { Button } from './Button'
import { Field, Line } from './Field'
import type { Choice } from './Pick'
import { Pick, asChoices } from './Pick'
import { StillSending } from './StillSending'
import { WayOut } from './WayOut'
import { whatWentWrong } from './whatWentWrong'

// Which account money left or landed in, and a way to add one without leaving the sitting.

// It was a second control under the picker, headed `Add an account`, on the day sheet only -- money coming in and paying out had no way at all. A box beside a box is the shape Nauman has been asking us to drop since the `<datalist>`, and it is what he was asking about again: the picker is where somebody is looking when they find the account missing.

// A name alone does not finish an account. `Which account` shows `Bank 4021 ···4021`, and two accounts at one bank are told apart by nothing else -- so adding asks for the number, and asks for nothing else.

export type Account = { _id: string; label: string }

/** Two accounts are the same account when he would say the same words. The server does not refuse a duplicate label, so this is the only thing standing between him and two rows he cannot tell apart. */
function theSameAccount(one: string, other: string): boolean {
  return one.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === other.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function PickAnAccount({
  label,
  problem,
  placeholder,
  chosen,
  accounts,
  onPick,
  onAdd,
}: {
  label: string
  problem?: string | null
  placeholder?: string
  chosen: Choice | null
  accounts: Array<Account>
  onPick: (choice: Choice | null) => void
  // Left out where there is nothing to add to yet. A screen whose list is still arriving, or did not load at all, cannot say whether the account is already there -- and the server does not refuse a duplicate label, so offering to add one there is offering him two rows he cannot tell apart.
  onAdd?: (label: string, lastFourDigits: string) => Promise<string>
}) {
  // What he typed, held while the number is asked for. `null` is nobody adding anything.
  const [naming, setNaming] = useState<string | null>(null)
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const asked = useRef<HTMLDivElement>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  // Brought onto the screen rather than left where it was drawn. It opens directly under the field, which is above the fold with the keyboard down -- and the keyboard is exactly what is up at that moment. Measured at 390: the question begins at y=311 and the button that finishes it ends at 469, which is under a keyboard on a phone this size.

  useEffect(() => {
    if (naming !== null) asked.current?.scrollIntoView({ block: 'nearest' })
  }, [naming])

  async function add(name: string, put: (label: string, lastFourDigits: string) => Promise<string>) {
    setSaving(true)
    setRefusal(null)

    // The last four are taken here, on the device, so the rest of the number never crosses the wire. That is not a formality: this runs on a phone he carries onto a site.
    const kept = lastFourOf.safeParse(number)
    if (!kept.success) {
      setRefusal(kept.error.issues[0]?.message ?? 'Put in the account number.')
      setSaving(false)

      return
    }

    try {
      const _id = await put(name, kept.data)

      // Picked as well as added, or he is back where he started with one more row on the list.
      onPick({ _id, name })
      setNaming(null)
      setNumber('')
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col">
      <Pick
        label={label}
        problem={problem}
        placeholder={placeholder ?? (accounts.length === 0 ? 'No accounts yet' : 'Pick one')}
        chosen={chosen}
        choices={asChoices(accounts)}
        onPick={onPick}
        onUseANewName={onAdd === undefined ? undefined : setNaming}
        theSame={theSameAccount}
      />

      {/* Under the field rather than inside the list, for the same reason as the trade: with the keyboard up there is about 300px of screen, and a question drawn inside a dropdown is a question under the keyboard. */}
      {naming === null || onAdd === undefined ? null : (
        <div ref={asked} className="border-border mt-3 flex flex-col gap-3 border-l-2 pl-4">
          <Field
            label={`Last figures of ${naming}`}
            hint="Only the last four are kept. The rest never leaves this phone."
          >
            <Line
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              aria-label={`The account number for ${naming}`}
            />
          </Field>

          <StillSending busy={saving} />
          {refusal === null ? null : (
            <p className="text-destructive text-sm" role="alert">
              {refusal}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => add(naming, onAdd)} busy={saving} className="py-2 text-sm">
              Add
            </Button>

            <WayOut
              onClick={() => {
                setNaming(null)
                setNumber('')
                setRefusal(null)
              }}
            >
              Cancel
            </WayOut>
          </div>
        </div>
      )}
    </div>
  )
}
