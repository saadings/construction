import { useEffect, useRef, useState } from 'react'
import { sameTrade } from '~shared/validation/trade'

import { WhatItIsFor } from '../settings/Trades'
import { Button } from './Button'
import type { Choice } from './Pick'
import { Pick } from './Pick'
import { whatWentWrong } from './whatWentWrong'

// What a payment was for, and a way to add one without leaving the sitting. Nauman, mid-entry on his phone: "in whats for I should be able to add something if that doesn't exist in our system".

// It was off on purpose and the reason survives the decision: a trade is not finished by its name. `countsAsBuildingCost` is what decides whether money spent lands in what the house cost or in land, taxes and commission, and a trade added with that guessed moves a figure on the Dashboard and the house screen with nothing anywhere saying it was guessed. So adding asks the one question, in the words `What for` already uses, and asks nothing else.

export type Trade = { _id: string; name: string }

export function PickATrade({
  label,
  problem,
  placeholder,
  chosen,
  trades,
  onPick,
  onAdd,
}: {
  label: string
  problem?: string | null
  placeholder?: string
  chosen: Choice | null
  trades: Array<Trade>
  onPick: (choice: Choice | null) => void
  onAdd: (trade: { name: string; countsAsBuildingCost: boolean }) => Promise<string>
}) {
  // The name he typed, held while the one remaining question is asked. `null` is nobody adding anything, which is every moment but this one.
  const [naming, setNaming] = useState<string | null>(null)
  const [building, setBuilding] = useState(true)
  const [saving, setSaving] = useState(false)
  const asked = useRef<HTMLDivElement>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  // Brought onto the screen rather than left where it was drawn. It opens directly under the field, which is above the fold with the keyboard down -- and the keyboard is exactly what is up at that moment. Measured at 390: the question begins at y=311 and the button that finishes it ends at 469, which is under a keyboard on a phone this size.

  useEffect(() => {
    if (naming !== null) asked.current?.scrollIntoView({ block: 'nearest' })
  }, [naming])

  async function add(name: string) {
    setSaving(true)
    setRefusal(null)

    try {
      const _id = await onAdd({ name, countsAsBuildingCost: building })

      // Picked as well as added. Adding a trade and leaving the field empty is the same walk again, and he is holding a cheque book.
      onPick({ _id, name })
      setNaming(null)
      setBuilding(true)
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
        placeholder={placeholder}
        chosen={chosen}
        choices={trades}
        onPick={onPick}
        onUseANewName={setNaming}
        // The ledger's own rule, so `  cement ` is offered as picking Cement rather than as adding a second one. The server refuses a duplicate anyway and says which name it is; this is so he never gets that far.
        theSame={sameTrade}
      />

      {/* Under the field rather than inside the list. At 390 with the keyboard up there is about 300px of screen, and a question drawn inside the dropdown is a question under the keyboard -- while everything here is where the rest of the form is, and the list has closed by the time it is drawn. */}
      {naming === null ? null : (
        <div ref={asked} className="border-border mt-3 flex flex-col gap-3 border-l-2 pl-4">
          <p className="text-foreground text-sm">Nothing on the list is called {naming}. What kind of cost is it?</p>

          <WhatItIsFor
            building={building}
            onChange={setBuilding}
            label={`Whether ${naming} is part of what the house cost`}
          />

          {refusal === null ? null : (
            <p className="text-destructive text-sm" role="alert">
              {refusal}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => add(naming)} busy={saving} className="py-2 text-sm">
              Put it on the list
            </Button>

            {/* A way out of a question he did not mean to open, in the same words as everywhere else it is offered. */}
            <button
              type="button"
              onClick={() => {
                setNaming(null)
                setRefusal(null)
              }}
              className="text-muted-foreground text-sm underline underline-offset-4"
            >
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
