import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { todayOnThisDevice } from '~shared/calendarDate'

import { api } from '../../../convex/_generated/api'
import { Dashboard } from '../components/dashboard/Dashboard'

export const Route = createFileRoute('/dashboard')({ component: EverythingAtOnce })

function EverythingAtOnce() {
  // Which day it is, read here and handed down rather than asked for by the query. The server's day is not his day: for the hours either side of midnight in Lahore the two disagree, and a `Paid out this month` counted on the server's calendar is a figure that changes month a few hours early.
  const today = todayOnThisDevice()

  // Handed over as it came: `undefined` is a reading still in flight, `null` is the ledger saying it has never seen this sign-in. Answering the second on its behalf is what leaves a screen watching for something that is not coming.
  const what = useQuery(api.dashboard.queries.whatIsHappening, { today })

  return <Dashboard what={what} />
}
