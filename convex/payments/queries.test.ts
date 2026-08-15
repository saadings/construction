// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
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

  // One cheque run is eight payments on one day, which is exactly when he is reading this against a cheque book. Two sites differing only in the order the rows went in must read the same, or the same screen says two different things on two days.
  it('lists a day of payments the same however the rows went in', async () => {
    const aRun = [1500, 87000, 12250]

    const asRead = []
    for (const order of [aRun, [...aRun].reverse()]) {
      const t = convexWithPayments()
      const siteId = await t.run(async (ctx) => {
        const { siteId, nauman } = await aSiteWithSpending(ctx)
        const trade = await ctx.db.query('trades').first()
        if (trade === null) throw new Error('the fixture wrote no trades')

        for (const rupees of order) {
          await ctx.db.insert('payments', {
            siteId,
            tradeId: trade._id,
            paidToId: nauman,
            paidById: nauman,
            day: '2025-11-03',
            amountPaisa: rupees * 100,
            method: 'cash',
            isExtraWork: false,
            removed: false,
            addedByExternalId: SIGNED_IN_AS,
          })
        }
        return siteId
      })

      const listed = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.payments.queries.forSite, { siteId })
      asRead.push((listed ?? []).slice(0, 3).map((payment) => payment.amountPaisa))
    }

    expect(asRead[0]).toEqual(asRead[1])
    // And the order itself, so this cannot pass by both readings being wrong in the same way.
    expect(asRead[0]).toEqual([8700000, 1225000, 150000])
  })

  it('reads out what went on one trade, in the words the screen shows', async () => {
    const t = convexWithPayments()
    const { siteId, paymentIds } = await t.run(aSiteWithSpending)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const cement = await t.run(async (ctx) => {
      const [first] = paymentIds
      if (!first) throw new Error('the fixture wrote no payments')
      const payment = await ctx.db.get('payments', first)
      if (payment === null) throw new Error('the fixture wrote no payments')

      // A second one on the same trade, on a later day and to a shop nobody will be paid again.
      await ctx.db.insert('payments', {
        siteId,
        tradeId: payment.tradeId,
        day: '2025-11-03',
        amountPaisa: 1500 * 100,
        method: 'cheque',
        reference: '0184',
        isExtraWork: false,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })

      return payment.tradeId
    })

    const went = await signedIn.query(api.payments.queries.onTrade, { siteId, tradeId: cement })

    // Newest first, because a wrong figure is usually the one just put in.
    expect(went?.map((one) => one.amountPaisa)).toEqual([150000, 257048100])
    expect(went?.[0]).toMatchObject({ day: '2025-11-03', method: 'cheque', reference: '0184' })
    // Nobody to name, so it says so rather than leaving the row anonymous.
    expect(went?.[0]?.paidToName).toBe('A one-off')
    expect(went?.[1]?.paidToName).toBe('The partner')
  })

  it('leaves a payment that was taken out off the trade it was on', async () => {
    const t = convexWithPayments()
    const { siteId, paymentIds } = await t.run(aSiteWithSpending)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const [cementPayment] = paymentIds
    if (!cementPayment) throw new Error('nothing was written to take back out')
    const cement = await t.run(async (ctx) => (await ctx.db.get('payments', cementPayment))?.tradeId)
    if (!cement) throw new Error('nothing was written to take back out')

    expect(await signedIn.query(api.payments.queries.onTrade, { siteId, tradeId: cement })).toHaveLength(1)

    await signedIn.mutation(api.payments.mutations.remove, { siteId, paymentId: cementPayment })

    expect(await signedIn.query(api.payments.queries.onTrade, { siteId, tradeId: cement })).toEqual([])
  })

  it('refuses to take out a payment that is on another house, rather than taking it out anyway', async () => {
    // The screen only ever names a payment it has just read, so this is about a call that did not come from one.
    const t = convexWithPayments()
    const { paymentIds } = await t.run(aSiteWithSpending)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const elsewhere = await t.run((ctx) =>
      ctx.db.insert('sites', { name: '2-B, Phase 0', builtForAClient: false, stage: 'building', hidden: false })
    )
    const [somebodyElses] = paymentIds
    if (!somebodyElses) throw new Error('nothing was written to take back out')

    expect(
      await refusalFrom(
        signedIn.mutation(api.payments.mutations.remove, { siteId: elsewhere, paymentId: somebodyElses })
      )
    ).toBe('That payment is not on this site.')

    // And it is still standing where it was.
    expect(await t.run((ctx) => ctx.db.get('payments', somebodyElses))).toMatchObject({ removed: false })
  })

  it('signs a removal, because a removal nobody signed is what a disagreement turns on', async () => {
    const t = convexWithPayments()
    const { siteId, paymentIds } = await t.run(aSiteWithSpending)

    const [cementPayment] = paymentIds
    if (!cementPayment) throw new Error('nothing was written to take back out')

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.payments.mutations.remove, {
      siteId,
      paymentId: cementPayment,
    })

    const taken = await t.run((ctx) => ctx.db.get('payments', cementPayment))
    expect(taken?.changedByExternalId).toBe(SIGNED_IN_AS)
    expect(typeof taken?.changedAt).toBe('number')
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
