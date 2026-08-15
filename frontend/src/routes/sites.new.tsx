import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { Page } from '../components/shell/Page'
import { HouseDetails } from '../components/sites/HouseDetails'

export const Route = createFileRoute('/sites/new')({ component: StartASite })

// The same questions correcting a house asks, from the same component: two forms would drift until one of them lost a field the other took.
function StartASite() {
  const router = useRouter()
  const start = useMutation(api.sites.mutations.start)

  return (
    <Page title="Start a house">
      <HouseDetails
        saying="Start it"
        onSave={async (house) => {
          await start(house)
          await router.navigate({ to: '/' })
        }}
      />
    </Page>
  )
}
