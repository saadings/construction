import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { People } from '../components/people/People'

export const Route = createFileRoute('/people')({ component: Everyone })

function Everyone() {
  const people = useQuery(api.people.queries.list, {})
  const add = useMutation(api.people.mutations.add)
  const hide = useMutation(api.people.mutations.hide)

  return (
    <People
      // Handed over as it came: `undefined` is a read still in flight, `null` is the ledger saying it does not know this sign-in. Answering the second on its behalf is what left somebody watching "Looking…" with nothing on the way.
      people={people}
      onAdd={async (person) => {
        await add(person)
      }}
      onHide={async (personId) => {
        await hide({ personId: personId as Parameters<typeof hide>[0]['personId'] })
      }}
    />
  )
}
