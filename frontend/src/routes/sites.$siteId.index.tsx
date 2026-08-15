import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { formatPaisa } from '~shared/money'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/sites/$siteId/')({ component: OneSite })

function OneSite() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const totals = useQuery(api.payments.queries.totals, forSite)

  if (site === undefined || totals === undefined) {
    return (
      <main className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center p-6">
        <p>Getting the site…</p>
      </main>
    )
  }

  // Both come back as nothing for a site that is not there and one that is not his, which is what the server refuses to tell apart.
  if (site === null || totals === null) {
    return (
      <main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-foreground font-display text-2xl">Nothing to open here.</p>
        <p className="text-muted-foreground max-w-xs">
          This house may have been put away, or you may not be on it. Ask Nauman.
        </p>
        <Link to="/" className="text-primary pt-2 font-medium">
          Back to your sites
        </Link>
      </main>
    )
  }

  return (
    <div className="bg-background min-h-dvh pb-28">
      <header className="mx-auto max-w-lg px-5 pt-7 pb-5">
        <Link to="/" className="text-muted-foreground text-sm">
          Sites
        </Link>
        <h1 className="text-foreground font-display mt-1 text-[2rem] leading-none">{site.name}</h1>

        <p className="text-muted-foreground mt-6 text-[0.75rem] font-medium tracking-[0.08em] uppercase">Spent</p>
        <p className="text-primary font-display -mt-1 text-[3rem] leading-none">{formatPaisa(totals.spentPaisa)}</p>

        <dl className="text-muted-foreground mt-4 flex gap-6 text-sm">
          <div>
            <dt className="text-[0.75rem] tracking-[0.06em] uppercase">Building</dt>
            <dd className="text-foreground text-base">{formatPaisa(totals.buildingCostPaisa)}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] tracking-[0.06em] uppercase">Land</dt>
            <dd className="text-foreground text-base">{formatPaisa(totals.plotCostPaisa)}</dd>
          </div>
        </dl>
      </header>

      <main className="mx-auto max-w-lg px-5">
        {totals.byTrade.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">Nothing spent on this house yet.</p>
        ) : (
          <ol className="border-border divide-border divide-y border-t border-b">
            {totals.byTrade.map((trade) => (
              <li key={trade.tradeId} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-foreground min-w-0 truncate">{trade.name}</span>
                <span className="text-foreground shrink-0 text-lg">{formatPaisa(trade.paisa)}</span>
              </li>
            ))}
          </ol>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0">
        <div className="mx-auto max-w-lg px-5 pb-6">
          <Link
            to="/sites/$siteId/day"
            params={{ siteId }}
            className="bg-primary text-primary-foreground block rounded-md py-3 text-center font-medium shadow-lg"
          >
            Put in a day
          </Link>
        </div>
      </div>
    </div>
  )
}
