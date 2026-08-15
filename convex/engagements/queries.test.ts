// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_thepartner'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithEngagements() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../engagements/queries.ts': () => import('./queries'),
    '../engagements/mutations.ts': () => import('./mutations'),
  })
}

// Two engagements, because one proves nothing: with a single person on a single trade, a query that ignores who and what entirely gives the right answer.

// A mason on civil labour: agreed 300,000, billed 340,000 once extra work landed, paid 325,000 so far.

// A steel supplier on steel: agreed 500,000, billed 520,000, paid 480,000. Every figure differs from the mason's, so a row carrying the other's would be wrong rather than coincidentally right.

// Invented from the first line. The shape is the workbooks'; none of the names or figures are.
async function aSiteWithAMasonOnIt(ctx: MutationCtx) {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const mason = await ctx.db.insert('people', { name: 'A mason', hidden: false })

  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId: partner, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  const tradeId = await ctx.db.insert('trades', {
    name: 'Civil labour',
    countsAsBuildingCost: true,
    position: 1,
    hidden: false,
  })

  await ctx.db.insert('engagements', { siteId, personId: mason, tradeId, agreedPaisa: 30_000_000, hidden: false })

  for (const [day, rupees] of [
    ['2025-09-01', 300_000],
    ['2025-10-01', 40_000],
  ] as const) {
    await ctx.db.insert('bills', {
      siteId,
      personId: mason,
      tradeId,
      day,
      amountPaisa: rupees * 100,
      removed: false,
      addedByExternalId: SIGNED_IN_AS,
    })
  }

  await ctx.db.insert('payments', {
    siteId,
    tradeId,
    paidToId: mason,
    paidById: partner,
    day: '2025-10-05',
    amountPaisa: 32_500_000,
    method: 'cash',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })

  const supplier = await ctx.db.insert('people', { name: 'A steel supplier', hidden: false })
  const steelTradeId = await ctx.db.insert('trades', {
    name: 'Steel',
    countsAsBuildingCost: true,
    position: 2,
    hidden: false,
  })

  await ctx.db.insert('engagements', {
    siteId,
    personId: supplier,
    tradeId: steelTradeId,
    agreedPaisa: 50_000_000,
    hidden: false,
  })

  for (const [day, rupees] of [
    ['2025-09-10', 300_000],
    ['2025-10-08', 220_000],
  ] as const) {
    await ctx.db.insert('bills', {
      siteId,
      personId: supplier,
      tradeId: steelTradeId,
      day,
      amountPaisa: rupees * 100,
      removed: false,
      addedByExternalId: SIGNED_IN_AS,
    })
  }

  await ctx.db.insert('payments', {
    siteId,
    tradeId: steelTradeId,
    paidToId: supplier,
    paidById: partner,
    day: '2025-10-12',
    amountPaisa: 48_000_000,
    method: 'transfer',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })

  return { siteId, mason, tradeId, partner, supplier, steelTradeId }
}

type Spread = { personName: string; agreedPaisa?: number; billedPaisa: number; paidPaisa: number }

// Named rather than taken by position, because a test that reads `spread[0]` passes when two rows swap and says nothing about which one it read.
function rowFor(spread: Array<Spread> | null, name: string): Spread | undefined {
  return (spread ?? []).find((row) => row.personName === name)
}

describe('agreed, billed and paid', () => {
  it('keeps all three apart, because their differing is the point', async () => {
    const t = convexWithEngagements()
    const { siteId } = await t.run(aSiteWithAMasonOnIt)

    const spread = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId })

    expect(spread).toHaveLength(2)
    const only = rowFor(spread, 'A mason')
    expect(only?.personName).toBe('A mason')
    // 300,000 agreed. 340,000 billed once extra work landed. 325,000 paid so far.
    expect(only?.agreedPaisa).toBe(30_000_000)
    expect(only?.billedPaisa).toBe(34_000_000)
    expect(only?.paidPaisa).toBe(32_500_000)
  })

  it('is three readings of one engagement, not one figure read three ways', async () => {
    // The control. Agreed-minus-paid works for a lump sum and fails completely for a supplier delivering load after load, so none of these may be derived from the others.
    const t = convexWithEngagements()
    const { siteId } = await t.run(aSiteWithAMasonOnIt)

    const spread = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId })
    const only = rowFor(spread, 'A mason')

    expect(new Set([only?.agreedPaisa, only?.billedPaisa, only?.paidPaisa]).size).toBe(3)
    // Due to extra work or redoing, in the words of the variance sheet.
    expect((only?.billedPaisa ?? 0) - (only?.agreedPaisa ?? 0)).toBe(4_000_000)
    // And what is still owed on it.
    expect((only?.billedPaisa ?? 0) - (only?.paidPaisa ?? 0)).toBe(1_500_000)
  })

  it('gives each engagement only its own bills and payments', async () => {
    // The one thing this query must never do. A mason's balance carrying the steel supplier's bills is the worst answer it can give, and with one engagement in the fixture a query ignoring who and what entirely would have looked perfect.
    const t = convexWithEngagements()
    const { siteId } = await t.run(aSiteWithAMasonOnIt)

    const spread = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId })

    expect(rowFor(spread, 'A mason')).toMatchObject({
      agreedPaisa: 30_000_000,
      billedPaisa: 34_000_000,
      paidPaisa: 32_500_000,
    })
    expect(rowFor(spread, 'A steel supplier')).toMatchObject({
      agreedPaisa: 50_000_000,
      billedPaisa: 52_000_000,
      paidPaisa: 48_000_000,
    })

    // And neither row is the whole site: the two together are what a query that stopped telling them apart would put on both.
    const everyBill = 34_000_000 + 52_000_000
    for (const row of spread ?? []) {
      expect(row.billedPaisa).not.toBe(everyBill)
    }
  })

  it('tells two engagements apart by the trade as well as the person', async () => {
    // The same man on two trades is ordinary -- a mason who also supplies sand -- and matching on the person alone puts one trade's bills on the other.
    const t = convexWithEngagements()
    const { siteId } = await t.run(async (ctx) => {
      const set = await aSiteWithAMasonOnIt(ctx)

      const sand = await ctx.db.insert('trades', {
        name: 'Sand',
        countsAsBuildingCost: true,
        position: 3,
        hidden: false,
      })
      await ctx.db.insert('engagements', {
        siteId: set.siteId,
        personId: set.mason,
        tradeId: sand,
        agreedPaisa: 8_000_000,
        hidden: false,
      })
      await ctx.db.insert('bills', {
        siteId: set.siteId,
        personId: set.mason,
        tradeId: sand,
        day: '2025-10-20',
        amountPaisa: 7_500_000,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })

      return set
    })

    const spread = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId })
    const hisTwo = (spread ?? []).filter((row) => row.personName === 'A mason')

    expect(hisTwo.map((row) => row.billedPaisa).sort((one, other) => one - other)).toEqual([7_500_000, 34_000_000])
  })

  it('tells two people on one trade apart', async () => {
    // Two masons on civil labour is ordinary, and matching on the trade alone puts one man's bills on the other -- which is the same mistake as matching on the person alone, wearing the other hat.
    const t = convexWithEngagements()
    const { siteId } = await t.run(async (ctx) => {
      const set = await aSiteWithAMasonOnIt(ctx)

      const second = await ctx.db.insert('people', { name: 'Another mason', hidden: false })
      await ctx.db.insert('engagements', {
        siteId: set.siteId,
        personId: second,
        tradeId: set.tradeId,
        agreedPaisa: 12_000_000,
        hidden: false,
      })
      await ctx.db.insert('bills', {
        siteId: set.siteId,
        personId: second,
        tradeId: set.tradeId,
        day: '2025-10-22',
        amountPaisa: 11_000_000,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })

      return set
    })

    const spread = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId })

    // Both are on the same trade, and neither has picked up the other's bill.
    expect(rowFor(spread, 'A mason')?.billedPaisa).toBe(34_000_000)
    expect(rowFor(spread, 'Another mason')?.billedPaisa).toBe(11_000_000)
  })

  it('leaves out a bill that was taken back out', async () => {
    const t = convexWithEngagements()
    const { siteId } = await t.run(async (ctx) => {
      const set = await aSiteWithAMasonOnIt(ctx)
      const extra = await ctx.db
        .query('bills')
        .withIndex('byPersonAndDay', (q) => q.eq('personId', set.mason).eq('day', '2025-10-01'))
        .unique()
      if (extra) await ctx.db.patch('bills', extra._id, { removed: true })
      return set
    })

    const only = rowFor(
      await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId }),
      'A mason'
    )

    expect(only?.billedPaisa).toBe(30_000_000)
    // Agreed and paid are untouched by it, which is what having three separate figures buys.
    expect(only?.agreedPaisa).toBe(30_000_000)
    expect(only?.paidPaisa).toBe(32_500_000)
  })

  it('records what was agreed and nothing else', async () => {
    const t = convexWithEngagements()
    const { siteId, mason, tradeId } = await t.run(aSiteWithAMasonOnIt)

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.engagements.mutations.agree, {
      siteId,
      personId: mason,
      tradeId,
      rate: '55',
      unit: 'square foot',
    })

    const written = await t.run((ctx) => ctx.db.query('engagements').collect())
    const byRate = written.find((each) => each.ratePaisa !== undefined)

    expect(byRate?.ratePaisa).toBe(5_500)
    expect(byRate?.unit).toBe('square foot')
    // Nothing about billing or paying lives on an engagement.
    expect(Object.keys(byRate ?? {}).some((key) => /billed|paid/i.test(key))).toBe(false)
  })

  it('refuses an engagement that agrees nothing at all', async () => {
    const t = convexWithEngagements()
    const { siteId, mason, tradeId } = await t.run(aSiteWithAMasonOnIt)

    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.engagements.mutations.agree, { siteId, personId: mason, tradeId })
      .then(
        () => 'nothing was refused',
        (thrown: unknown) =>
          thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
      )

    expect(refusal).toContain('what was agreed')
  })

  it('refuses a rate with nothing it is a rate for', async () => {
    const t = convexWithEngagements()
    const { siteId, mason, tradeId } = await t.run(aSiteWithAMasonOnIt)

    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.engagements.mutations.agree, { siteId, personId: mason, tradeId, rate: '55' })
      .then(
        () => 'nothing was refused',
        (thrown: unknown) =>
          thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
      )

    expect(refusal).toContain('what the rate is for')
  })
})

describe('raising a bill', () => {
  it('does not need one before a payment can go out', async () => {
    // Most spending never has a bill. Money goes out on account, and asking for one first would be a worse Excel.
    const t = convexWithEngagements()
    const { siteId, mason, tradeId, partner } = await t.run(aSiteWithAMasonOnIt)

    await t.run(async (ctx) => {
      await ctx.db.insert('payments', {
        siteId,
        tradeId,
        paidToId: mason,
        paidById: partner,
        day: '2025-11-01',
        amountPaisa: 1_000_000,
        method: 'cash',
        isExtraWork: false,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
    })

    const only = rowFor(
      await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.engagements.queries.spread, { siteId }),
      'A mason'
    )

    // Paid moved; billed did not. A payment settles the balance, never a bill.
    expect(only?.paidPaisa).toBe(33_500_000)
    expect(only?.billedPaisa).toBe(34_000_000)
  })

  it('keeps their own number on it, and who raised it', async () => {
    const t = convexWithEngagements()
    const { siteId, mason, tradeId } = await t.run(aSiteWithAMasonOnIt)

    const billId = await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.bills.mutations.raise, {
      siteId,
      personId: mason,
      tradeId,
      day: '2025-11-02',
      amount: '12,500',
      reference: 'CH-0001',
      description: 'Extra work on the boundary wall',
    })

    const bill = await t.run((ctx) => ctx.db.get('bills', billId))
    expect(bill?.amountPaisa).toBe(1_250_000)
    expect(bill?.reference).toBe('CH-0001')
    expect(bill?.addedByExternalId).toBe(SIGNED_IN_AS)
    expect(bill?.removed).toBe(false)
  })

  it('signs a removal and keeps who raised it', async () => {
    const t = convexWithEngagements()
    const { siteId, mason, tradeId } = await t.run(aSiteWithAMasonOnIt)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const billId = await signedIn.mutation(api.bills.mutations.raise, {
      siteId,
      personId: mason,
      tradeId,
      day: '2025-11-02',
      amount: '12,500',
    })
    await signedIn.mutation(api.bills.mutations.remove, { siteId, billId })

    const bill = await t.run((ctx) => ctx.db.get('bills', billId))
    expect(bill?.removed).toBe(true)
    expect(bill?.changedByExternalId).toBe(SIGNED_IN_AS)
    expect(bill?.changedAt).toBeGreaterThan(0)
    // The first signature survives a removal, the same rule a payment follows.
    expect(bill?.addedByExternalId).toBe(SIGNED_IN_AS)
  })

  it('cannot reach a bill belonging to another site', async () => {
    const t = convexWithEngagements()
    const { siteId, mason, tradeId, partner } = await t.run(aSiteWithAMasonOnIt)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const billId = await signedIn.mutation(api.bills.mutations.raise, {
      siteId,
      personId: mason,
      tradeId,
      day: '2025-11-02',
      amount: '12,500',
    })

    const elsewhere = await t.run(async (ctx) => {
      const id = await ctx.db.insert('sites', {
        name: '2-B, Phase 0',
        builtForAClient: false,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.insert('siteRoles', { personId: partner, siteId: id, capacity: 'partner' })
      return id
    })

    const refusal = await signedIn.mutation(api.bills.mutations.remove, { siteId: elsewhere, billId }).then(
      () => 'nothing was refused',
      (thrown: unknown) =>
        thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
    )

    expect(refusal).toContain('not on this site')
    expect(await t.run((ctx) => ctx.db.get('bills', billId))).toMatchObject({ removed: false })
  })
})
