import { sameName } from '~shared/validation/person'

import type { Choice } from './Pick'
import { NOT_ON_THE_LIST, Pick } from './Pick'

// Anybody, picked or typed, wherever a screen has to name somebody. Nauman: "Same should happen for all of the other stuff as well."

// The day sheet and money coming in could already do this; a share, an engagement and a contract could not, and each of them is a moment where the person is new by definition -- a mason arriving on a house, a client at the moment the contract is agreed.

// A person is finished by a name, which is what makes this one control rather than a control and a question. A trade and a bank account are not, and they have their own.

export type Named = { _id: string; name: string }

/** Somebody picked from the list, or a name typed into it, as one answer. */
export type WhoIsNamed = { personId: string; newPerson: string }

export const NOBODY: WhoIsNamed = { personId: '', newPerson: '' }

/** What the one control is holding: the person picked, or the name typed while nobody is picked. */
export function whoIsShown(who: WhoIsNamed, people: Array<Named>): Choice | null {
  const picked = people.find((person) => person._id === who.personId)
  if (picked !== undefined) {
    return picked
  }

  return who.newPerson === '' ? null : { _id: NOT_ON_THE_LIST, name: who.newPerson }
}

/** What one answer means. A name already on the list is that person however it was spelt, so a typed name can never make a second row of somebody the ledger already has. */
export function whoWasMeant(chosen: Choice | null, people: Array<Named>): WhoIsNamed {
  if (chosen === null) {
    return NOBODY
  }

  const already = people.find((person) => person._id === chosen._id || sameName(person.name, chosen.name))

  return already === undefined ? { personId: '', newPerson: chosen.name } : { personId: already._id, newPerson: '' }
}

/** What the server is sent: the id when he was picked, the name when he was typed, and never both. */
export function asAsked(who: WhoIsNamed): { personId?: string; newPerson?: string } {
  return who.personId === '' ? { newPerson: who.newPerson } : { personId: who.personId }
}

export function PickAPerson({
  label,
  hint = 'Pick one, or type a name.',
  problem,
  placeholder = 'A person or a shop',
  who,
  people,
  onChange,
}: {
  label: string
  hint?: string
  problem?: string | null
  placeholder?: string
  who: WhoIsNamed
  people: Array<Named>
  onChange: (who: WhoIsNamed) => void
}) {
  const chosen = whoIsShown(who, people)

  return (
    <Pick
      label={label}
      hint={
        chosen !== null && chosen._id === NOT_ON_THE_LIST
          ? `Nobody on the list is called that. ${chosen.name} will be added.`
          : hint
      }
      problem={problem}
      placeholder={placeholder}
      chosen={chosen}
      choices={people}
      canUseANewName
      onPick={(picked) => {
        onChange(whoWasMeant(picked, people))
      }}
    />
  )
}
