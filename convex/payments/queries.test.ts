// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_nauman'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithPayments() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../payments/mutations.ts': () => import('./mutations'),
    '../payments/queries.ts': () => import('./queries'),
  })
}

// Figures from the workbooks, in rupees, so a wrong answer is recognisable rather than arbitrary.
const SPEND: Array<[string, boolean, number]> = [
  ['Cement', true, 2570481],
  ['Bricks', true, 1839200],
  // The workbook left this out of its own headline figure and nobody noticed for ten years. Here it counts like any other trade.
  ['Supervision charges', true, 900000],
  ['Plot', false, 40000000],
  ['Plot taxes and transfer fees', false, 1000000],
  ['Dealer commission', false, 475000],
]

async function aSiteWithSpending(ctx: MutationCtx) {
  const nauman = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId: nauman, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'nauman@example.com',
    otherEmails: [],
    personId: nauman,
  })

  const paymentIds: Array<Id<'payments'>> = []
  for (const [position, [name, countsAsBuildingCost, rupees]] of SPEND.entries()) {
    const tradeId = await ctx.db.insert('trades', { name, countsAsBuildingCost, position, hidden: false })

    paymentIds.push(
      await ctx.db.insert('payments', {
        siteId,
        tradeId,
        paidById: nauman,
        paidToId: nauman,
        day: '2025-10-07',
        amountPaisa: rupees * 100,
        method: 'cash',
        isExtraWork: false,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
    )
  }

  return { siteId, nauman, paymentIds }
}

describe('what a site has cost', () => {
  it('adds up the rows and nothing else', async () => {
    const t = convexWithPayments()
    const { siteId } = await t.run(aSiteWithSpending)

    const totals = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.payments.queries.totals, { siteId })

    // 2,570,481 + 1,839,200 + 900,000. The supervision charge is in it, which is the figure the workbook missed.
    expect(totals?.buildingCostPaisa).toBe(530968100)
    // 40,000,000 + 1,000,000 + 475,000.
    expect(totals?.plotCostPaisa).toBe(4147500000)
    // Not a third sum. The two above are every payment on the site, split in two.
    expect(totals?.spentPaisa).toBe(4678468100)
  })

  it('never lets the two sides disagree with the whole', async () => {
    // The A client workbook stated a figure its own rows could not reach: a million counted with nothing behind it against nine hundred thousand paid and never counted.
    const t = convexWithPayments()
    const { siteId } = await t.run(aSiteWithSpending)

    const totals = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.payments.queries.totals, { siteId })
    const fromTheRows = (totals?.byTrade ?? []).reduce((sum, trade) => sum + trade.paisa, 0)

    expect((totals?.buildingCostPaisa ?? 0) + (totals?.plotCostPaisa ?? 0)).toBe(totals?.spentPaisa)
    expect(fromTheRows).toBe(totals?.spentPaisa)
  })

  it('drops a payment that was taken out, from both sides at once', async () => {
    const t = convexWithPayments()
    const { siteId, paymentIds } = await t.run(aSiteWithSpending)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    // The cement payment, which is the first of the building-cost ones.
    const [cementPayment] = paymentIds
    if (!cementPayment) throw new Error('nothing was written to take back out')
    await signedIn.mutation(api.payments.mutations.remove, { siteId, paymentId: cementPayment })

    const totals = await signedIn.query(api.payments.queries.totals, { siteId })

    expect(totals?.buildingCostPaisa).toBe(530968100 - 257048100)
    expect(totals?.spentPaisa).toBe(4678468100 - 257048100)
    expect(totals?.byTrade.map((trade) => trade.name)).not.toContain('Cement')
    // Gone from the figures, still there to settle an argument with.
    expect(await t.run((ctx) => ctx.db.get('payments', cementPayment))).toMatchObject({ removed: true })
  })

  it('follows the flag and not the name when a trade is renamed', async () => {
    // Nothing anywhere may special-case the plot trades by name, or renaming a row silently moves money across the line.
    const t = convexWithPayments()
    const { siteId } = await t.run(aSiteWithSpending)

    await t.run(async (ctx) => {
      const plot = await ctx.db
        .query('trades')
        .withIndex('byName', (q) => q.eq('name', 'Plot'))
        .unique()
      if (!plot) throw new Error('no Plot trade')

      await ctx.db.patch('trades', plot._id, { name: 'Land purchase' })
    })

    const totals = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.payments.queries.totals, { siteId })

    expect(totals?.plotCostPaisa).toBe(4147500000)
    expect(totals?.buildingCostPaisa).toBe(530968100)
    expect(totals?.byTrade.map((trade) => trade.name)).toContain('Land purchase')
  })

  it('shows every house in the ledger, and nothing for one that is not there', async () => {
    const t = convexWithPayments()
    await t.run(aSiteWithSpending)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const elsewhere = await t.run((ctx) =>
      ctx.db.insert('sites', { name: '2-B, Phase 0', builtForAClient: false, stage: 'building', hidden: false })
    )
    // A house somebody else started, with nothing on it yet: zero rather than nothing at all.
    expect(await signedIn.query(api.payments.queries.totals, { siteId: elsewhere })).toMatchObject({ spentPaisa: 0 })
    expect(await signedIn.query(api.payments.queries.forSite, { siteId: elsewhere })).toEqual([])

    const gone = await t.run(async (ctx) => {
      await ctx.db.delete('sites', elsewhere)
      return elsewhere
    })
    expect(await signedIn.query(api.payments.queries.totals, { siteId: gone })).toBeNull()
    expect(await signedIn.query(api.payments.queries.forSite, { siteId: gone })).toBeNull()
  })
})
