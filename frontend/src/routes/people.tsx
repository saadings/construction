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
      // Undefined while the answer is on its way, null when the sign-in has not landed here yet. The screen says "looking" for both, because both are a moment rather than a state anybody stays in.
      people={people ?? null}
      onAdd={async (person) => {
        await add(person)
      }}
      onHide={async (personId) => {
        await hide({ personId: personId as Parameters<typeof hide>[0]['personId'] })
      }}
    />
  )
}
