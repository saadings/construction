// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import {
  CLIENT_POSITION,
  CLIENT_SITE_SPEND,
  CONSTRUCTION_EXPENDITURE,
  COUNTED_WITH_NOTHING_BEHIND_IT,
  MARKET_PAYABLES,
  PAID_BUT_NEVER_COUNTED,
} from '../shared/fixtures/oneClientSite'
import { rupeesToPaisa } from '../shared/money'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import schema from './schema'

// Ten years of hand arithmetic, fed through the calculations that replaced it. `shared/fixtures/oneClientSite.test.ts` checks the figures against each other; this checks the app against the figures, which is the promise the design makes and the only one that can fail for the app's reasons.

// When a figure disagrees, either side can be the wrong one -- the sheets contain at least one error this fixture is built around -- so every expected value here is written with its working beside it rather than as a number nobody can re-derive.
const SIGNED_IN_AS = 'user_partner'

function convexWithEverything() {
  return convexTest(schema, import.meta.glob('./**/*.*s'))
}

const signedIn = (t: ReturnType<typeof convexWithEverything>) => t.withIdentity({ subject: SIGNED_IN_AS })

type TheHouse = { siteId: Id<'sites'>; client: Id<'people'> }

// The sheet's own trades, with the one it forgot. Names and figures only: the workbooks carry people, mobiles, accounts and cheque numbers, and none of those are here in any form.
async function theClientSite(ctx: MutationCtx): Promise<TheHouse> {
  const client = await ctx.db.insert('people', { name: 'The one it is built for', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: 'A client house',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  // The four trades whose payments add up to what is written above them, plus supervision -- paid, recorded, and left out of the sheet's own total.
  const spend = [
    ...CLIENT_SITE_SPEND,
    { trade: PAID_BUT_NEVER_COUNTED.trade, rupees: PAID_BUT_NEVER_COUNTED.rupees, countsAsBuildingCost: true },
    // A plot cost, so the split has something on both sides of it.
    { trade: 'Plot', rupees: 4_000_000, countsAsBuildingCost: false },
  ]

  for (const [position, line] of spend.entries()) {
    const tradeId = await ctx.db.insert('trades', {
      name: line.trade,
      countsAsBuildingCost: line.countsAsBuildingCost,
      position,
      hidden: false,
    })

    await ctx.db.insert('payments', {
      siteId,
      tradeId,
      // Nobody named, the way most of the sheet's rows are: money handed over at a shop is the house's cost and no one's account.
      day: '2026-04-01',
      amountPaisa: rupeesToPaisa(line.rupees),
      method: 'cheque',
      isExtraWork: false,
      removed: false,
      addedByExternalId: SIGNED_IN_AS,
    })
  }

  return { siteId, client }
}

describe('what the sheets say, put through the calculations that replaced them', () => {
  it('counts the supervision charge the sheet forgot, because the flag decides and not the name', async () => {
    // The workbook dropped it and nobody noticed for ten years. It is a site cost and Nauman's income from one row, which is the case the design singles out.
    const t = convexWithEverything()
    const { siteId } = await t.run(theClientSite)

    const totals = await signedIn(t).query(api.payments.queries.totals, { siteId })

    // 1,062,800 + 786,000 + 859,280 + 336,800 + 900,000.
    expect(totals?.buildingCostPaisa).toBe(rupeesToPaisa(1_062_800 + 786_000 + 859_280 + 336_800 + 900_000))
    expect(totals?.byTrade.map((trade) => trade.name)).toContain(PAID_BUT_NEVER_COUNTED.trade)
  })

  it('keeps land on the other side of the line, and the two halves come to the whole', async () => {
    const t = convexWithEverything()
    const { siteId } = await t.run(theClientSite)

    const totals = await signedIn(t).query(api.payments.queries.totals, { siteId })

    expect(totals?.plotCostPaisa).toBe(rupeesToPaisa(4_000_000))
    // Not a third sum, which is the thing the sheets could not hold: 58,641 and 33,132,003 are what happens when a total is typed rather than added.
    expect((totals?.buildingCostPaisa ?? 0) + (totals?.plotCostPaisa ?? 0)).toBe(totals?.spentPaisa)
  })

  it('has nowhere to put the figure the sheet counted with nothing behind it', async () => {
    // A million rupees typed into a TOTAL row with no payment anywhere under it. There is no box for it here, so the only way it could reach a total is as a payment -- and then it would have a row, a day and a signature.
    const t = convexWithEverything()
    const { siteId } = await t.run(theClientSite)

    const totals = await signedIn(t).query(api.payments.queries.totals, { siteId })

    expect(totals?.byTrade.map((trade) => trade.name)).not.toContain(COUNTED_WITH_NOTHING_BEHIND_IT.trade)
    expect(COUNTED_WITH_NOTHING_BEHIND_IT.payments).toBe(0)
  })

  it('reaches the market payables register by calculation, to the rupee', async () => {
    // Thirteen rows kept by hand beside the ledger, three of them still outstanding. The app has no register: it is what everyone is still owed, added up.
    const t = convexWithEverything()
    await t.run(async (ctx) => {
      const { siteId } = await theClientSite(ctx)
      const trade = await ctx.db.query('trades').first()
      if (trade === null) throw new Error('the fixture wrote no trades')

      for (const line of MARKET_PAYABLES.outstanding) {
        const personId = await ctx.db.insert('people', { name: line.owed, hidden: false })

        await ctx.db.insert('bills', {
          siteId,
          personId,
          tradeId: trade._id,
          day: '2026-04-01',
          amountPaisa: rupeesToPaisa(line.rupees),
          removed: false,
          addedByExternalId: SIGNED_IN_AS,
        })
      }

      // And somebody paid ahead of what he has billed, which `ADV` and `BL PMT` make ordinary all over these sheets. The register must not come down by his credit: an advance held by one man is not money available to pay another.
      const ahead = await ctx.db.insert('people', { name: 'One paid ahead', hidden: false })
      await ctx.db.insert('payments', {
        siteId,
        tradeId: trade._id,
        paidToId: ahead,
        day: '2026-04-02',
        amountPaisa: rupeesToPaisa(200_000),
        method: 'cash',
        isExtraWork: false,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
    })

    const owed = await signedIn(t).query(api.owed.queries.position, {})

    // 763,701 + 770,000 + 58,000, and not a rupee less for the 200,000 held against it.
    expect(owed?.payablePaisa).toBe(rupeesToPaisa(MARKET_PAYABLES.stated))
    expect(owed?.advancedPaisa).toBe(rupeesToPaisa(200_000))
    // Netted it would read 1,391,701, which is a figure nobody can act on: it is neither what is owed nor what is available.
    expect(owed?.payablePaisa).not.toBe(rupeesToPaisa(MARKET_PAYABLES.stated - 200_000))
  })

  it('has nowhere to put the amount the sheet wrote beside nobody', async () => {
    // 455 in an amount column with no name against it. Every bill here points at a person, so a figure owed to nobody cannot be written down -- which is why the register comes to 1,591,701 and not 1,592,156.
    expect(MARKET_PAYABLES.stated + MARKET_PAYABLES.strayUnlabelledAmount).toBe(1_592_156)

    const t = convexWithEverything()
    const { siteId, client } = await t.run(theClientSite)
    const trade = await t.run(async (ctx) => (await ctx.db.query('trades').first())?._id)
    if (!trade) throw new Error('the fixture wrote no trades')

    // The nearest the schema allows is a bill against somebody, and then it is not beside nobody any more.
    await t.run(async (ctx) => {
      await ctx.db.insert('bills', {
        siteId,
        personId: client,
        tradeId: trade,
        day: '2026-04-01',
        amountPaisa: rupeesToPaisa(MARKET_PAYABLES.strayUnlabelledAmount),
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
    })

    const owed = await signedIn(t).query(api.owed.queries.position, {})

    expect(owed?.everyone.map((one) => one.name)).toContain('The one it is built for')
    expect(owed?.payablePaisa).toBe(rupeesToPaisa(MARKET_PAYABLES.strayUnlabelledAmount))
  })

  it('closes the house from its own rows, which is a different figure from the one the sheet closes at', async () => {
    // The sheet closes through its stated construction figure, and that figure carries the plug. Asserting the app against it would condemn correct code, and the natural response to a red test is to change the code.
    const t = convexWithEverything()
    const siteId = await t.run(async (ctx) => {
      const { siteId, client } = await theClientSite(ctx)

      for (const [why, rupees] of [
        ['clientPayment', CLIENT_POSITION.receivedInCash],
        ['partnerMoney', CLIENT_POSITION.spentByAPartnerOnTheClientsBehalf],
      ] as const) {
        await ctx.db.insert('moneyIn', {
          siteId,
          fromId: client,
          day: '2026-04-01',
          amountPaisa: rupeesToPaisa(rupees),
          why,
          method: 'cheque',
          removed: false,
          addedByExternalId: SIGNED_IN_AS,
        })
      }

      return siteId
    })

    const received = await signedIn(t).query(api.moneyIn.queries.totals, { siteId })

    // 9,152,000 in cash and 2,382,570 a partner spent on the client's behalf.
    expect(received?.receivedPaisa).toBe(rupeesToPaisa(CLIENT_POSITION.totalReceipts))

    // The gap between the two closings is the plug less what was never counted, and asserting it against its cause is what stops either being quietly adjusted to match the other.
    const apart = CLIENT_POSITION.asItsOwnPaymentsAddUp - CLIENT_POSITION.asTheSheetClosesIt

    expect(apart).toBe(COUNTED_WITH_NOTHING_BEHIND_IT.rupees - PAID_BUT_NEVER_COUNTED.rupees)
    expect(
      CLIENT_POSITION.totalReceipts - (CONSTRUCTION_EXPENDITURE.asItsOwnPaymentsAddUp + MARKET_PAYABLES.stated)
    ).toBe(CLIENT_POSITION.asItsOwnPaymentsAddUp)
  })

  it('is reading a ledger with something in it, so every figure above is about the app rather than about nothing', async () => {
    // The control. Every assertion here would pass against an empty deployment reading zero, and a fixture that wrote nothing would look exactly like an app that agrees.
    const t = convexWithEverything()
    const { siteId } = await t.run(theClientSite)

    const totals = await signedIn(t).query(api.payments.queries.totals, { siteId })

    expect(totals?.spentPaisa).toBeGreaterThan(0)
    expect(totals?.byTrade.length).toBe(CLIENT_SITE_SPEND.length + 2)
  })
})
