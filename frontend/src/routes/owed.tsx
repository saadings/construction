import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { WhatWeOwe } from '../components/owed/WhatWeOwe'

export const Route = createFileRoute('/owed')({ component: WhatIsOwedAltogether })

function WhatIsOwedAltogether() {
  // Handed over as it came: `undefined` is a reading still in flight, `null` is the ledger saying it has never seen this sign-in. Answering the second on its behalf is what leaves a screen watching for something that is not coming.
  const owed = useQuery(api.owed.queries.position, {})

  return <WhatWeOwe owed={owed} />
}
