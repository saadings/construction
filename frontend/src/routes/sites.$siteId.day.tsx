import { createFileRoute, useRouter } from '@tanstack/react-router'

import { ADayOfPayments } from '../components/daySheet/ADayOfPayments'

export const Route = createFileRoute('/sites/$siteId/day')({ component: ADayOnSite })

// A day of payments against this house, reached from the house itself. The house is in the address, so nothing is picked here.

// Everything under it is `ADayOfPayments`, shared with `/daybook`. The two were the same forty lines of wiring written twice, which is how they come to disagree about what a refusal says or which day the sheet opens on.
function ADayOnSite() {
  const { siteId } = Route.useParams()
  const router = useRouter()

  return (
    <ADayOfPayments
      siteId={siteId}
      // Back to the house and not to the list: the figure he has just moved is that house's, and watching it move is the whole reason the day was entered.
      whereToAfterwards={async (went) => {
        await router.navigate({ to: '/sites/$siteId', params: { siteId: went } })
      }}
    />
  )
}
