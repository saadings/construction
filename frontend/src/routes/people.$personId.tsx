import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { TheirAccount } from '../components/people/TheirAccount'

export const Route = createFileRoute('/people/$personId')({ component: OnePerson })

function OnePerson() {
  const { personId } = Route.useParams()

  // Handed over as it came: `undefined` is a reading still in flight, `null` is the ledger saying it has never seen this sign-in, and an answer holding no account is nobody by that name. Three unknowns, and the screen answers all three.
  const answer = useQuery(api.owed.queries.statement, { personId: personId as Id<'people'> })

  return <TheirAccount answer={answer} />
}
