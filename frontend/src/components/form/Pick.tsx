import { useState } from 'react'

import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '../ui/combobox'
import { Choices, Field } from './Field'

// One way to pick anything in this app. Every list used to be a `<select>` and one was a `<datalist>`, and both are drawn by the browser: Nauman sent a screenshot of the datalist's popup in Chrome's mauve, sitting over the error text, and there is no CSS we can write that reaches it.

// The item is the object, not its name. What the mutation wants is the id, and a control that hands back a string makes somebody find the id again -- which is a bug the first time two people share a name.
export type Choice = { _id: string; name: string }

// A name typed rather than picked, which is what a shop nobody will pay twice looks like. The id is empty because there is no row yet; the server finds or creates through `personAlreadyCalled`, so a name already on the list is that person and never a second row.
export const NOT_ON_THE_LIST = ''

/** A row named by something other than `name`. A bank account is a `label`, because that is what somebody calls it out loud: "Bank 0000". */
export function asChoices(rows: Array<{ _id: string; label: string }>): Array<Choice> {
  return rows.map((row) => ({ _id: row._id, name: row.label }))
}

export function Pick({
  label,
  hint,
  problem,
  placeholder,
  chosen,
  choices,
  onPick,
  canUseANewName = false,
  onUseANewName,
  theSame = (one, other) => one.toLocaleLowerCase() === other.toLocaleLowerCase(),
}: {
  label: string
  hint?: string
  problem?: string | null
  placeholder?: string
  chosen: Choice | null
  choices: Array<Choice>
  onPick: (choice: Choice | null) => void
  // Off unless a screen says otherwise. A name alone is a whole person, and it is not a whole trade or a whole account.
  canUseANewName?: boolean
  // For the kinds a name does not finish. Handed the typed name instead of completing the pick, so the screen can ask the one thing left and add it itself.

  // A trade carries whether it is part of what the house cost, and a bank account carries the four figures he tells it apart by. Guessing either is a wrong figure or an unpickable row, and neither would ever be flagged.
  onUseANewName?: (name: string) => void
  // What counts as the same name. The default is what a person reads as the same word; the ledger's own rules also ignore spacing, and the offer must never appear for something already on the list -- a second `Cement` is the two-rows-for-one-thing that `personAlreadyCalled` exists to stop, arriving on a side that has no such guard.
  theSame?: (one: string, other: string) => boolean
}) {
  const [typed, setTyped] = useState('')

  // Held here rather than left to the control, for one reason: taking up the offer opens a question underneath, and a list still hanging over that question covers the thing it just asked. Measured at 390 -- the popup ended at y=360 and the question began at 311.
  const [open, setOpen] = useState(false)

  // Said as what will happen rather than as "no results". The ledger has no one-off: a payment has to point at somebody, so the honest offer is to use the name.
  const wanted = typed.trim()
  const alreadyThere = choices.some((choice) => theSame(choice.name, wanted))

  return (
    <Field label={label} hint={hint} problem={problem}>
      <Combobox
        items={choices}
        value={chosen}
        onValueChange={(picked: Choice | null) => {
          onPick(picked)
        }}
        // The name drives filtering and display; the object stays the item all the way through, so nothing has to be looked up again from a string.
        itemToStringLabel={(choice: Choice) => choice.name}
        itemToStringValue={(choice: Choice) => choice.name}
        onInputValueChange={setTyped}
        open={open}
        onOpenChange={setOpen}
      >
        {/* Undoing shadcn's own `md:text-sm`, which is the trap the day picker fell into and this one had it on ten call sites: measured in the gallery at 1280, every picker in the app was 14px while everything beside it was 16 to 44. Below `md` it was already 16, so a phone never shows it, which is what makes it the half nobody looks at. */}

        {/* Said at the box rather than on it, because a `ComboboxInput` hands its `className` to the group it wraps and never to the input inside. A descendant selector is more specific than the utility it is undoing, so this reaches what a prop cannot. */}
        <ComboboxInput placeholder={placeholder} aria-label={label} className="[&_input]:md:text-base" />

        <ComboboxContent>
          {/* Said once. The offer to use a typed name lives below the list, where it is the same offer whether anything matched or not -- two of them appeared here the first time, one in this slot and one under the list, and two identical offers is a choice nobody asked to make. */}
          <ComboboxEmpty>
            <span className="text-muted-foreground px-2 py-1.5 text-sm">Nothing here by that name.</span>
          </ComboboxEmpty>

          <ComboboxList>
            {(choice: Choice) => (
              <ComboboxItem key={choice._id} value={choice}>
                {choice.name}
              </ComboboxItem>
            )}
          </ComboboxList>

          {/* Offered alongside the matches too, not only when nothing matches. He may type a name that is the beginning of one already on the list, and hiding the offer then is the case that would send him looking for a second box again. */}
          {(canUseANewName || onUseANewName !== undefined) && wanted !== '' && !alreadyThere ? (
            <button
              type="button"
              onClick={() => {
                // Handed on rather than picked, when the screen has something left to ask. A person is finished at this point and a trade is not.
                if (onUseANewName === undefined) {
                  onPick({ _id: NOT_ON_THE_LIST, name: wanted })
                } else {
                  setOpen(false)
                  onUseANewName(wanted)
                }
              }}
              className="text-primary border-border w-full border-t px-2 py-1.5 text-left text-sm font-medium"
            >
              Use “{wanted}”
            </button>
          ) : null}
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

export { Choices }
