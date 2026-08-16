import type { Named, WhoIsNamed } from '../form/PickAPerson'
import { PickAPerson, whoIsShown, whoWasMeant } from '../form/PickAPerson'

// One place to answer one question. It was a picker with a name box waiting underneath it, then a `<datalist>` whose popup Chrome draws in its own colours over the error text -- Nauman on both: "this is not good UX", "not acceptable".

// The control itself is `PickAPerson` now, which every screen that names somebody uses. What stays here is the one thing that is this screen's: a payment's answer is called `paidToId`, because a draft holds what the server is sent.

export type { Named }

export type WhoIsPaid = { paidToId: string; newPerson: string }

function asNamed(who: WhoIsPaid): WhoIsNamed {
  return { personId: who.paidToId, newPerson: who.newPerson }
}

function asPaid(who: WhoIsNamed): WhoIsPaid {
  return { paidToId: who.personId, newPerson: who.newPerson }
}

/** What the one control is holding, in this screen's words. */
export function whoIsShownAsPaid(who: WhoIsPaid, people: Array<Named>) {
  return whoIsShown(asNamed(who), people)
}

/** What one answer means, in this screen's words. A name already on the list is that person however it was spelt. */
export function whoWasPaidMeant(chosen: Parameters<typeof whoWasMeant>[0], people: Array<Named>): WhoIsPaid {
  return asPaid(whoWasMeant(chosen, people))
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
  return (
    <PickAPerson
      label="Paid to"
      // A shop nobody will be paid twice is still a person here, because a payment has to point at somebody.
      problem={problem}
      who={asNamed(who)}
      people={people}
      onChange={(named) => {
        onChange(asPaid(named))
      }}
    />
  )
}
