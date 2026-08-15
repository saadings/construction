import { useId } from 'react'
import { sameName } from '~shared/validation/person'

import { Field, Line } from '../form/Field'

// One place to answer one question. It was a picker and a name box underneath it, so answering "who" meant first deciding which of the two boxes you meant -- an implementation detail turned into a decision.

// Nauman: "This is not good UX".
export type Named = { _id: string; name: string }

export type WhoIsPaid = { paidToId: string; newPerson: string }

/** What the one box shows: the person picked, or the name typed while nobody is picked. */
export function whoIsShown(who: WhoIsPaid, people: Array<Named>): string {
  return people.find((person) => person._id === who.paidToId)?.name ?? who.newPerson
}

/** What one typed answer means. A name already on the list is that person however it was spelt, and anything else is a name being used as it stands. */
export function whoWasMeant(typed: string, people: Array<Named>): WhoIsPaid {
  const already = people.find((person) => sameName(person.name, typed))

  return already === undefined ? { paidToId: '', newPerson: typed } : { paidToId: already._id, newPerson: '' }
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
  const list = useId()
  const shown = whoIsShown(who, people)

  // Typed and not on the list. Said as what will happen rather than as a warning: the ledger has no one-off, because a payment has to point at somebody.
  const willBeAdded = shown.trim() !== '' && who.paidToId === ''

  return (
    <Field
      label="Who was paid"
      hint={
        willBeAdded ? `Nobody on the list is called that. ${shown.trim()} will be added.` : 'Pick one, or type a name.'
      }
      problem={problem}
    >
      <Line
        value={shown}
        onChange={(event) => {
          onChange(whoWasMeant(event.target.value, people))
        }}
        list={list}
        aria-label="Who was paid"
        autoComplete="off"
        placeholder="A person or a shop"
      />
      {/* The list the browser offers as he types, rather than a second control to choose between. It filters itself, which forty-odd names need and a picker of that length does not do. */}
      <datalist id={list}>
        {people.map((person) => (
          <option key={person._id} value={person.name} />
        ))}
      </datalist>
    </Field>
  )
}
