import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { NotKnownHere } from '../components/shell/NotKnownHere'
import { SitesList, SitesListWaiting } from '../components/sites/SitesList'

// No signed-out branch: the root never renders a route to somebody signed out, so one here would be a screen nothing can reach.
export const Route = createFileRoute('/')({ component: HisSites })

function HisSites() {
  const sites = useQuery(api.sites.queries.all, {})

  // Waiting. Nothing has come back yet, so the screen holds the shape of the list rather than a word in the middle of an empty page.
  if (sites === undefined) {
    return <SitesListWaiting />
  }

  // An answer, and a definite one: the ledger does not know this sign-in. Shown as waiting it becomes a spinner nobody can get past, which is what it was.
  if (sites === null) {
    return (
      <main className="bg-background flex min-h-dvh flex-col justify-center p-6">
        <NotKnownHere />
      </main>
    )
  }

  return <SitesList sites={sites} />
}
