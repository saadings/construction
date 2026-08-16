import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { Dashboard } from '../components/dashboard/Dashboard'

export const Route = createFileRoute('/dashboard')({ component: EverythingAtOnce })

function EverythingAtOnce() {
  // Handed over as it came: `undefined` is a reading still in flight, `null` is the ledger saying it has never seen this sign-in. Answering the second on its behalf is what leaves a screen watching for something that is not coming.
  const what = useQuery(api.dashboard.queries.whatIsHappening, {})

  return <Dashboard what={what} />
}
