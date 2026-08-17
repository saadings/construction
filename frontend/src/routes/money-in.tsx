import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { EverythingThatCameIn } from '../components/moneyIn/EverythingThatCameIn'

export const Route = createFileRoute('/money-in')({ component: WhatHasComeInAltogether })

function WhatHasComeInAltogether() {
  // Handed over as it came: `undefined` is a reading still in flight, `null` is the ledger saying it has never seen this sign-in. Answering the second on its behalf is what leaves a screen watching for something that is not coming.
  const everything = useQuery(api.moneyIn.queries.everywhere, {})

  return <EverythingThatCameIn everything={everything} />
}
