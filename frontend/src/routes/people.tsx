import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'

import { api } from '../../../convex/_generated/api'
import { People } from '../components/people/People'

export const Route = createFileRoute('/people')({ component: Everyone })

function Everyone() {
  const people = useQuery(api.people.queries.list, {})
  const add = useMutation(api.people.mutations.add)
  const edit = useMutation(api.people.mutations.edit)
  const hide = useMutation(api.people.mutations.hide)

  // Looked up in the list it came from rather than cast, and waiting is not refused: `people ?? []` here would say somebody is gone when the read had simply not come back.
  const which = (personId: string) => {
    if (people === undefined) {
      throw new ConvexError('The list is still coming. Try again in a moment.')
    }

    if (people === null) {
      throw new ConvexError('The list did not come back. Sign out and in again.')
    }

    const person = people.find((one) => one._id === personId)
    if (person === undefined) {
      throw new ConvexError('That person is not on the list any more.')
    }

    return person._id
  }

  return (
    <People
      // Handed over as it came: `undefined` is a read still in flight, `null` is the ledger saying it does not know this sign-in. Answering the second on its behalf is what left somebody watching "Looking…" with nothing on the way.
      people={people}
      onAdd={async (person) => {
        await add(person)
      }}
      onEdit={async (personId, person) => {
        await edit({ personId: which(personId), ...person })
      }}
      onHide={async (personId) => {
        await hide({ personId: which(personId) })
      }}
    />
  )
}
