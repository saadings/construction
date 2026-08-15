import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { formatPaisa } from '~shared/money'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Positions } from '../components/partners/Positions'
import { Figure, Page } from '../components/shell/Page'
import { Skeleton, WhileWaiting } from '../components/shell/Skeleton'
import { Billing } from '../components/site/Billing'
import type { TradeSpend } from '../components/site/SpentByTrade'
import { SpentByTrade } from '../components/site/SpentByTrade'
import { ChangeTheHouse } from '../components/sites/ChangeTheHouse'
import type { Stage } from '../components/sites/HouseDetails'
import { STAGES } from '../components/sites/HouseDetails'

export const Route = createFileRoute('/sites/$siteId/')({ component: OneHouse })

function OneHouse() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const totals = useQuery(api.payments.queries.totals, forSite)
  const edit = useMutation(api.sites.mutations.edit)
  const putAway = useMutation(api.sites.mutations.hide)
  const router = useRouter()

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
        <span className="flex flex-wrap items-center gap-2">
          {/* Money in and money out, the two halves of the house, reached the same way. */}
          <Link
            to="/sites/$siteId/coming-in"
            params={{ siteId }}
            className="border-border text-foreground rounded-md border px-4 py-2 text-sm font-medium"
          >
            Money coming in
          </Link>
          <Link
            to="/sites/$siteId/day"
            params={{ siteId }}
            className="bg-brass text-background rounded-md px-4 py-2 text-sm font-medium"
          >
            Put in a day
          </Link>
        </span>
      }
    >
      <section className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <Amount label="Spent" paisa={totals.spentPaisa} big />
        <Amount label="Building" paisa={totals.buildingCostPaisa} />
        <Amount label="Land" paisa={totals.plotCostPaisa} />
      </section>

      <WhatItWentOn siteId={forSite.siteId} byTrade={totals.byTrade} />

      {/* The one thing deciding whether a house shows billing or a sale. A house built for the partners has no client to bill. */}
      {site.builtForAClient ? <Billing siteId={forSite.siteId} /> : null}

      <WhatThePartnersAreOwed siteId={forSite.siteId} />

      <ChangeTheHouse
        house={{
          name: site.name,
          // Held as it is typed, because that is what the box takes back.
          coveredAreaSqft: site.coveredAreaSqft === undefined ? '' : site.coveredAreaSqft.toLocaleString('en-US'),
          // Looked up in the list the picker is drawn from, so a stage the app does not know cannot reach it.
          stage: STAGES.find((each) => each.value === site.stage)?.value ?? ('building' as Stage),
          builtForAClient: site.builtForAClient,
        }}
        onSave={async (corrected) => {
          await edit({ siteId: forSite.siteId, ...corrected })
        }}
        onPutAway={async () => {
          await putAway(forSite)
          // Back to the houses, because the one being looked at is no longer on the list.
          await router.navigate({ to: '/' })
        }}
      />
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

// The payments behind one figure, asked for only once somebody opens it: a house has trades nobody is looking at, and reading all of them to show one is a page that gets slower the longer the house runs.
function WhatItWentOn({ siteId, byTrade }: { siteId: Id<'sites'>; byTrade: Array<TradeSpend> }) {
  const [opened, setOpened] = useState<string | null>(null)
  const [takingOut, setTakingOut] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  const went = useQuery(
    api.payments.queries.onTrade,
    opened === null ? 'skip' : { siteId, tradeId: opened as Id<'trades'> }
  )
  const remove = useMutation(api.payments.mutations.remove)

  return (
    <SpentByTrade
      byTrade={byTrade}
      onOpen={(tradeId) => {
        setOpened(tradeId)
        setRefusal(null)
      }}
      // Handed over as it came: `undefined` is a reading on its way, `null` is an answer. Flattening them is what leaves a screen watching for something that is not coming.
      opened={opened === null ? null : { tradeId: opened, went }}
      takingOut={takingOut}
      refusal={refusal}
      onTakeOut={async (paymentId) => {
        setTakingOut(paymentId)
        setRefusal(null)

        try {
          await remove({ siteId, paymentId: paymentId as Id<'payments'> })

          return true
        } catch (thrown) {
          // The sentence the server refused with, which is written for him. A removal that quietly does nothing is the worst of both: the figure stays and nobody is told why.
          setRefusal(thrown instanceof ConvexError ? String(thrown.data) : 'That did not come out. Try once more.')

          return false
        } finally {
          setTakingOut(null)
        }
      }}
    />
  )
}

// Asked for separately from the totals above, so a house with nobody's money in it yet still opens rather than waiting on a figure it does not need.
function WhatThePartnersAreOwed({ siteId }: { siteId: Id<'sites'> }) {
  const what = useQuery(api.partners.queries.positions, { siteId })

  // Handed over as it came: two different unknowns, and flattening them is what left a screen watching "Looking…" with nothing on the way.
  return (
    <Positions
      what={what}
      beside={
        <Link to="/sites/$siteId/shares" params={{ siteId }} className="text-brass font-medium">
          Change
        </Link>
      }
    />
  )
}
