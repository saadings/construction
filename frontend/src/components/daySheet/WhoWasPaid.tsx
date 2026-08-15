import { sameName } from '~shared/validation/person'

import type { Choice } from '../form/Pick'
import { NOT_ON_THE_LIST, Pick } from '../form/Pick'

// One place to answer one question. It was a picker with a name box waiting underneath it, then a `<datalist>` whose popup Chrome draws in its own colours over the error text -- Nauman on both: "this is not good UX", "not acceptable".

// Now one control the app draws itself, where typing a name nobody has offers to use it rather than sending him to a second box.
export type Named = { _id: string; name: string }

export type WhoIsPaid = { paidToId: string; newPerson: string }

/** What the one control is holding: the person picked, or the name typed while nobody is picked. */
export function whoIsShown(who: WhoIsPaid, people: Array<Named>): Choice | null {
  const picked = people.find((person) => person._id === who.paidToId)
  if (picked !== undefined) {
    return picked
  }

  return who.newPerson === '' ? null : { _id: NOT_ON_THE_LIST, name: who.newPerson }
}

/** What one answer means. A name already on the list is that person however it was spelt, so a typed name can never make a second row of somebody the ledger already has. */
export function whoWasMeant(chosen: Choice | null, people: Array<Named>): WhoIsPaid {
  if (chosen === null) {
    return { paidToId: '', newPerson: '' }
  }

  const already = people.find((person) => person._id === chosen._id || sameName(person.name, chosen.name))

  return already === undefined ? { paidToId: '', newPerson: chosen.name } : { paidToId: already._id, newPerson: '' }
}

export function WhoWasPaid({
  who,
  people,
  problem,
  onChange,
}: {
  who: WhoIsPaid
  people: Array<Named>
  problem?: string | null
  onChange: (who: WhoIsPaid) => void
}) {
  const chosen = whoIsShown(who, people)

  return (
    <Pick
      label="Who was paid"
      hint={
        chosen !== null && chosen._id === NOT_ON_THE_LIST
          ? `Nobody on the list is called that. ${chosen.name} will be added.`
          : 'Pick one, or type a name.'
      }
      problem={problem}
      placeholder="A person or a shop"
      chosen={chosen}
      choices={people}
      // A shop nobody will be paid twice is still a person here, because a payment has to point at somebody.
      canUseANewName
      onPick={(picked) => {
        onChange(whoWasMeant(picked, people))
      }}
    />
  )
}
