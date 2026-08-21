import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { asDayHeWrites } from '~shared/calendarDate'
import { paisaToRupees } from '~shared/money'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { whatWentWrong } from '../components/form/whatWentWrong'
import { WhatHasComeIn } from '../components/moneyIn/WhatHasComeIn'
import { Positions } from '../components/partners/Positions'
import { Page } from '../components/shell/Page'
import { Pill } from '../components/shell/Panel'
import { Skeleton, WhileWaiting } from '../components/shell/Skeleton'
import { Billing } from '../components/site/Billing'
import { HouseTiles } from '../components/site/HouseTiles'
import { LatestEntries } from '../components/site/LatestEntries'
import type { TradeSpend } from '../components/site/SpentByTrade'
import { SpentByTrade } from '../components/site/SpentByTrade'
import { WhoIsOnThisHouse } from '../components/site/WhoIsOnThisHouse'
import { ChangeTheHouse } from '../components/sites/ChangeTheHouse'
import type { Stage } from '../components/sites/HouseDetails'
import { STAGES } from '../components/sites/HouseDetails'

export const Route = createFileRoute('/sites/$siteId/')({ component: OneHouse })

function OneHouse() {
  const { siteId } = Route.useParams()
  const forSite = { siteId: siteId as Id<'sites'> }

  const site = useQuery(api.sites.queries.one, forSite)
  const totals = useQuery(api.payments.queries.totals, forSite)
  // What the drawn header and the four tiles are read off. Each is a reading the app already answers, asked on its own, so one slow one does not hold up the rest of the page.
  const contract = useQuery(api.contracts.queries.forSite, forSite)
  const latest = useQuery(api.payments.queries.latest, forSite)
  // Asked for rather than added up from the rows: a total worked out on the screen disagrees with the one every other reading uses the moment a receipt is taken back out.
  const comeIn = useQuery(api.moneyIn.queries.totals, forSite)
  const edit = useMutation(api.sites.mutations.edit)
  const putAway = useMutation(api.sites.mutations.hide)
  const router = useRouter()

  // The contract is waited on with the rest rather than folded into "no contract". `null` from that reading means *this house has none*, which is what makes the margin tile absent -- so answering it on its behalf while it is still coming would take the tile off the screen and put it back a moment later.
  if (site === undefined || totals === undefined || contract === undefined) {
    return <OneHouseWaiting />
  }

  if (site === null || totals === null) {
    return (
      <Page title="Nothing to open here">
        <p className="text-muted-foreground max-w-prose">This house may have been put away.</p>
        <Link to="/" className="text-brass font-medium">
          Back to sites
        </Link>
      </Page>
    )
  }

  return (
    <Page
      title={site.name}
      named={{ siteId: site.name }}
      said={<WhatThisHouseIs site={site} />}
      beside={
        <span className="flex flex-wrap items-center gap-2">
          {/* Money in and money out, the two halves of the house, reached the same way -- and each named after the screen it opens, so the button, the rail row and the page title all say one word. `Invested` and `Date` were neither the screen's name nor plain English; he read them off the live site and said so. */}
          <Link
            to="/sites/$siteId/coming-in"
            params={{ siteId }}
            className="border-border text-foreground rounded-md border px-4 py-3 text-sm font-medium"
          >
            Receipts
          </Link>
          <Link
            to="/sites/$siteId/day"
            params={{ siteId }}
            className="bg-brass text-background rounded-md px-4 py-3 text-sm font-medium"
          >
            Daybook
          </Link>
        </span>
      }
    >
      {/* The four figures he draws across the top, each read off a query the app already answers. `Spent` was three figures in a row before it -- what has gone out, and how that splits between the build and the land -- and that split now lives under `Cost by category`, which is where a person looks for it. */}
      <HouseTiles
        what={{
          spentPaisa: totals.spentPaisa,
          receivedPaisa: comeIn === undefined || comeIn === null ? 0 : comeIn.receivedPaisa,
          budgetEstimatePaisa: site.budgetEstimatePaisa,
          // `null` here is a house with no contract, which is a house the partnership is building to sell. It has arrived by now: the page above waits for it.
          contractPaisa: contract === null ? null : contract.valuePaisa,
        }}
      />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <WhatItWentOn siteId={forSite.siteId} byTrade={totals.byTrade} />

        <div className="flex flex-col gap-5">
          <LatestEntries siteId={siteId} what={latest} />
          <WhatHasComeIn siteId={siteId} totals={comeIn} />
        </div>
      </section>

      {/* The one thing deciding whether a house shows billing or a sale. A house built for the partners has no client to bill. */}
      {site.builtForAClient ? <Billing siteId={forSite.siteId} /> : null}

      <WhoIsOnIt siteId={forSite.siteId} />

      <WhatThePartnersAreOwed siteId={forSite.siteId} />

      <ChangeTheHouse
        house={{
          name: site.name,
          // Held as it is typed, because that is what the box takes back.
          coveredAreaSqft: site.coveredAreaSqft === undefined ? '' : site.coveredAreaSqft.toLocaleString('en-US'),
          // Read back in rupees, grouped the same way `Covered area` above it is. Not `formatPaisa`: that is what puts a figure on a screen, and this is a value going back into a box.

          // Loaded rather than left empty. `edit` patches what it is given and an absent key removes the field, so a form opening blank here would clear an estimate the moment somebody corrected the stage.
          budgetEstimatePaisa:
            site.budgetEstimatePaisa === undefined
              ? ''
              : paisaToRupees(site.budgetEstimatePaisa).toLocaleString('en-US'),
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

// What a house is, said under its name the way he draws it: the stage, who it is for, how big it is and when it started. Each piece is left out where the house has not been told it, and the separators belong to the pieces rather than to the line -- a house with nothing filled in shows its stage and nothing else, rather than three dots with gaps between them.
function WhatThisHouseIs({
  site,
}: {
  site: { stage: Stage; builtForAClient: boolean; clientName?: string; coveredAreaSqft?: number; startedOn?: string }
}) {
  const said = [
    site.clientName === undefined ? (site.builtForAClient ? 'For a client' : 'Ours to sell') : `For ${site.clientName}`,
    site.coveredAreaSqft === undefined ? undefined : `${site.coveredAreaSqft.toLocaleString('en-US')} sqft`,
    site.startedOn === undefined ? undefined : `Started ${asDayHeWrites(site.startedOn)}`,
  ].filter((piece) => piece !== undefined)

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {/* Plain, as drawn on this screen and on the houses list. The tinted planes are his Dashboard's and a partner's role. */}
      <Pill>{STAGES.find((each) => each.value === site.stage)?.label ?? site.stage}</Pill>
      <span>{said.join(' · ')}</span>
    </span>
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
          setRefusal(whatWentWrong(thrown, 'That did not come out. Try once more.'))

          return false
        } finally {
          setTakingOut(null)
        }
      }}
    />
  )
}

// Who is on this house and what they say they are owed. Asked for on its own, like the rest of the sections, so one slow reading does not hold up the page.
function WhoIsOnIt({ siteId }: { siteId: Id<'sites'> }) {
  const engaged = useQuery(api.engagements.queries.spread, { siteId })
  const claimed = useQuery(api.bills.queries.forSite, { siteId })
  const people = useQuery(api.people.queries.list, {})
  const trades = useQuery(api.trades.queries.list, {})

  const agree = useMutation(api.engagements.mutations.agree)
  const raise = useMutation(api.bills.mutations.raise)
  const takeOut = useMutation(api.bills.mutations.remove)
  const addTrade = useMutation(api.trades.mutations.add)

  const [saving, setSaving] = useState(false)
  const [takingOut, setTakingOut] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  // The sentence the server refused with, which is written for him. Anything else is the app failing rather than him being wrong.
  async function through(sending: Promise<unknown>): Promise<boolean> {
    setRefusal(null)

    try {
      await sending

      return true
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))

      return false
    }
  }

  return (
    <WhoIsOnThisHouse
      engaged={engaged}
      claimed={claimed}
      people={people}
      trades={trades}
      saving={saving}
      refusal={refusal}
      takingOut={takingOut}
      onAddTrade={async (trade) => await addTrade(trade)}
      onAgree={async (engagement) => {
        setSaving(true)

        try {
          return await through(
            agree({
              siteId,
              personId: engagement.personId as Id<'people'>,
              tradeId: engagement.tradeId as Id<'trades'>,
              agreed: engagement.agreed,
              rate: engagement.rate,
              unit: engagement.unit,
            })
          )
        } finally {
          setSaving(false)
        }
      }}
      onRaise={async (bill) => {
        setSaving(true)

        try {
          return await through(
            raise({
              siteId,
              personId: bill.personId as Id<'people'>,
              tradeId: bill.tradeId as Id<'trades'>,
              day: bill.day,
              amount: bill.amount,
              reference: bill.reference,
            })
          )
        } finally {
          setSaving(false)
        }
      }}
      onTakeOut={async (billId) => {
        setTakingOut(billId)

        try {
          return await through(takeOut({ siteId, billId: billId as Id<'bills'> }))
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
      // The row that reaches the screen is part of the feature rather than part of the nav. `Paid` is a column on the table above and there was no way to put anything in it; `Change`, beside a sentence about shares, is not one -- nobody holding a cheque stub reads it as the way to write the cheque down. Named for the thing rather than the act, because the app moves no money: somebody has already paid him.
      beneath={
        <p className="text-sm">
          <Link to="/sites/$siteId/shares" params={{ siteId }} className="text-brass font-medium">
            Paid out
          </Link>
        </p>
      }
    />
  )
}
