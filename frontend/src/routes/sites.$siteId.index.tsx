import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { formatPaisa } from '~shared/money'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Positions } from '../components/partners/Positions'
import { Figure, Page } from '../components/shell/Page'
import { Skeleton, WhileWaiting } from '../components/shell/Skeleton'
import { Billing } from '../components/site/Billing'
import { SpentByTrade } from '../components/site/SpentByTrade'

export const Route = createFileRoute('/sites/$siteId/')({ component: OneHouse })

function OneHouse() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const totals = useQuery(api.payments.queries.totals, forSite)

  if (site === undefined || totals === undefined) {
    return <OneHouseWaiting />
  }

  if (site === null || totals === null) {
    return (
      <Page title="Nothing to open here">
        <p className="text-muted max-w-prose">This house may have been put away.</p>
        <Link to="/" className="text-brass font-medium">
          Back to the houses
        </Link>
      </Page>
    )
  }

  return (
    <Page
      title={site.name}
      beside={
        <Link
          to="/sites/$siteId/day"
          params={{ siteId }}
          className="bg-brass text-background rounded-md px-4 py-2 text-sm font-medium"
        >
          Put in a day
        </Link>
      }
    >
      <section className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <Amount label="Spent" paisa={totals.spentPaisa} big />
        <Amount label="Building" paisa={totals.buildingCostPaisa} />
        <Amount label="Land" paisa={totals.plotCostPaisa} />
      </section>

      <SpentByTrade byTrade={totals.byTrade} />

      {/* The one thing deciding whether a house shows billing or a sale. A house built for the partners has no client to bill. */}
      {site.builtForAClient ? <Billing siteId={forSite.siteId} /> : null}

      <WhatThePartnersAreOwed siteId={forSite.siteId} />
    </Page>
  )
}

// The three figures and the table under them, in their own shape and at their own sizes. A page that says "…" and then lays itself out is a page that moves under the eye the moment it arrives.
function OneHouseWaiting() {
  return (
    <Page title="Getting the house">
      <WhileWaiting what="Getting the house">
        <section className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-56 max-w-full" />
          </div>
          {[0, 1].map((figure) => (
            <div key={figure} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </section>

        <div className="divide-hairline mt-4 flex flex-col divide-y">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2.5">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-4 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </WhileWaiting>
    </Page>
  )
}

function Amount({ label, paisa, big = false }: { label: string; paisa: number; big?: boolean }) {
  return (
    <div>
      <p className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{label}</p>
      <Figure className={big ? 'text-brass text-[2.5rem] leading-none' : 'text-foreground text-xl'}>
        {formatPaisa(paisa)}
      </Figure>
    </div>
  )
}

// Asked for separately from the totals above, so a house with nobody's money in it yet still opens rather than waiting on a figure it does not need.
function WhatThePartnersAreOwed({ siteId }: { siteId: Id<'sites'> }) {
  const what = useQuery(api.partners.queries.positions, { siteId })

  // Handed over as it came: two different unknowns, and flattening them is what left a screen watching "Looking…" with nothing on the way.
  return <Positions what={what} />
}
