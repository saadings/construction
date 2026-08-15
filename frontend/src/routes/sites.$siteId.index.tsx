import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { formatPaisa } from '~shared/money'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Figure, Page } from '../components/shell/Page'
import { Billing } from '../components/site/Billing'
import { SpentByTrade } from '../components/site/SpentByTrade'

export const Route = createFileRoute('/sites/$siteId/')({ component: OneHouse })

function OneHouse() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const totals = useQuery(api.payments.queries.totals, forSite)

  if (site === undefined || totals === undefined) {
    return <Page title="…">{null}</Page>
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
