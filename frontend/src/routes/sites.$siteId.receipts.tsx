import { createFileRoute } from '@tanstack/react-router'

import { AReceiptComingIn } from '../components/moneyIn/AReceiptComingIn'

export const Route = createFileRoute('/sites/$siteId/receipts')({ component: WhatCameIn })

// Money arriving against this house, reached from the house itself. The house is in the address, so nothing is picked here.

// Everything under it is `AReceiptComingIn`, shared with `/receipts/new`.
function WhatCameIn() {
  const { siteId } = Route.useParams()

  return <AReceiptComingIn siteId={siteId} />
}
