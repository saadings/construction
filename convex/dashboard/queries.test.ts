// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithTheDashboard() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../dashboard/queries.ts': () => import('./queries'),
  })
}

type Ledger = {
  first: Id<'sites'>
  second: Id<'sites'>
  partner: Id<'people'>
  client: Id<'people'>
  supplier: Id<'people'>
  steel: Id<'trades'>
  cement: Id<'trades'>
}

const signedIn = (t: ReturnType<typeof convexWithTheDashboard>) => t.withIdentity({ subject: SIGNED_IN_AS })

async function aSignIn(ctx: MutationCtx) {
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })
}

// Two houses, because every figure on this screen is across all of them and one house cannot tell a total from a per-house figure.
async function twoHouses(ctx: MutationCtx): Promise<Ledger> {
  await aSignIn(ctx)

  const person = async (name: string) => await ctx.db.insert('people', { name, hidden: false })
  const house = async (name: string) =>
    await ctx.db.insert('sites', { name, builtForAClient: true, stage: 'building', hidden: false })
  const trade = async (name: string, position: number) =>
    await ctx.db.insert('trades', { name, countsAsBuildingCost: true, position, hidden: false })

  return {
    first: await house('1-A, Phase 0'),
    second: await house('2-B, Phase 0'),
    partner: await person('The partner'),
    client: await person('The one it is built for'),
    supplier: await person('A steel supplier'),
    steel: await trade('Steel', 1),
    cement: await trade('Cement', 2),
  }
}

async function paid(ctx: MutationCtx, at: Ledger, over: Partial<Record<string, unknown>> = {}) {
  await ctx.db.insert('payments', {
    siteId: at.first,
    tradeId: at.steel,
    paidToId: at.supplier,
    day: '2026-04-02',
    amountPaisa: 100_000_00,
    method: 'cash',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
    ...over,
  })
}

async function cameIn(ctx: MutationCtx, at: Ledger, over: Partial<Record<string, unknown>> = {}) {
  await ctx.db.insert('moneyIn', {
    siteId: at.first,
    day: '2026-04-01',
    amountPaisa: 500_000_00,
    fromId: at.client,
    why: 'clientPayment',
    method: 'transfer',
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
    ...over,
  })
}

describe('what is happening across every house', () => {
  it('says how much of what came in is the partners’ own money', async () => {
    // The line under the biggest figure on the screen. Without it the largest number reads as profit, and a house is not profitable the moment somebody funds it.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await cameIn(ctx, at, { amountPaisa: 500_000_00, why: 'clientPayment' })
      await cameIn(ctx, at, { amountPaisa: 124_000_00, why: 'partnerMoney', fromId: at.partner })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})

    expect(read?.comeIn.receivedPaisa).toBe(624_000_00)
    // Part of the total, said beside it rather than taken out of it: it did come in.
    expect(read?.comeIn.ownMoneyPaisa).toBe(124_000_00)
  })

  it('keeps what is owed and what is held apart, and never nets them', async () => {
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await ctx.db.insert('bills', {
        siteId: at.first,
        personId: at.supplier,
        tradeId: at.steel,
        day: '2026-04-01',
        amountPaisa: 750_000_00,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
      // A mason paid more than he was billed is holding an advance, which is not money available to pay the supplier.
      await paid(ctx, at, { paidToId: at.client, amountPaisa: 150_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})

    expect(read?.owed.payablePaisa).toBe(750_000_00)
    expect(read?.owed.advancedPaisa).toBe(150_000_00)
  })

  it('reads the same figures the Owed screen reads, from the same pass', async () => {
    // The seam this screen is most likely to fail at: a tile and a screen answering one question from two copies of the arithmetic.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await ctx.db.insert('bills', {
        siteId: at.second,
        personId: at.supplier,
        tradeId: at.cement,
        day: '2026-04-01',
        amountPaisa: 300_000_00,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
      await paid(ctx, at, { amountPaisa: 100_000_00 })
    })

    const dashboard = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})
    const screen = await signedIn(t).query(api.owed.queries.position, {})

    expect(dashboard?.owed.payablePaisa).toBe(screen?.payablePaisa)
    expect(dashboard?.owed.advancedPaisa).toBe(screen?.advancedPaisa)
  })

  it('gathers the trades past the sixth rather than dropping them', async () => {
    // A chart that silently leaves out what does not fit says the houses cost less than they did.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      for (let each = 0; each < 9; each += 1) {
        const tradeId = await ctx.db.insert('trades', {
          name: `Trade ${each}`,
          countsAsBuildingCost: true,
          position: each + 3,
          hidden: false,
        })
        await paid(ctx, at, { tradeId, amountPaisa: (9 - each) * 10_000_00 })
      }
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})
    const shown = read?.whereItWent ?? []

    expect(shown).toHaveLength(7)
    expect(shown[6].name).toBe('Everything else (3)')
    // Every rupee is on the chart. The gathered tail and the six named come to what went out altogether.
    expect(shown.reduce((total, one) => total + one.paisa, 0)).toBe(read?.goneOutPaisa)
  })

  it('splits what came in by month, keeping funding apart from what the house brought in', async () => {
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await cameIn(ctx, at, { day: '2026-03-15', why: 'partnerMoney', fromId: at.partner, amountPaisa: 200_000_00 })
      await cameIn(ctx, at, { day: '2026-04-01', why: 'clientPayment', amountPaisa: 500_000_00 })
      await cameIn(ctx, at, { day: '2026-04-20', why: 'sale', amountPaisa: 300_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})

    // Oldest first, because a chart of months is read left to right.
    expect(read?.whatCameIn).toEqual([
      { month: '2026-03', ownMoneyPaisa: 200_000_00, broughtInPaisa: 0 },
      { month: '2026-04', ownMoneyPaisa: 0, broughtInPaisa: 800_000_00 },
    ])
  })

  it('leaves out what was taken back out, on both sides', async () => {
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await paid(ctx, at, { amountPaisa: 100_000_00 })
      await paid(ctx, at, { amountPaisa: 900_000_00, removed: true })
      await cameIn(ctx, at, { amountPaisa: 500_000_00 })
      await cameIn(ctx, at, { amountPaisa: 700_000_00, removed: true })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})

    expect(read?.goneOutPaisa).toBe(100_000_00)
    expect(read?.comeIn.receivedPaisa).toBe(500_000_00)
  })

  it('lists the houses with what each has taken and taken in, and leaves out one put away', async () => {
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await paid(ctx, at, { siteId: at.second, amountPaisa: 800_000_00 })
      await paid(ctx, at, { siteId: at.first, amountPaisa: 100_000_00 })
      await cameIn(ctx, at, { siteId: at.first, amountPaisa: 500_000_00 })

      const gone = await ctx.db.insert('sites', {
        name: 'A house put away',
        builtForAClient: false,
        stage: 'sold',
        hidden: true,
      })
      await paid(ctx, at, { siteId: gone, amountPaisa: 1_000_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})

    // Most spent first: the house taking the money is the house he is thinking about.
    expect(read?.houses.map((house) => [house.name, house.goneOutPaisa, house.comeInPaisa])).toEqual([
      ['2-B, Phase 0', 800_000_00, 0],
      ['1-A, Phase 0', 100_000_00, 500_000_00],
    ])
  })

  it('says plainly when nothing has been put in yet', async () => {
    // His first day: one house and nothing in it. A dashboard that draws charts over four zeroes is what everybody ships, so the screen is told rather than left to work it out.
    const t = convexWithTheDashboard()
    await t.run(twoHouses)

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, {})

    expect(read?.nothingYet).toBe(true)
    expect(read?.houses).toHaveLength(2)
    expect(read?.whereItWent).toEqual([])
    expect(read?.whatCameIn).toEqual([])
  })

  it('stops saying so the moment anything is put in', async () => {
    // The control. A flag that is always true is not a flag.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await cameIn(ctx, at, { amountPaisa: 1_00 })
    })

    expect((await signedIn(t).query(api.dashboard.queries.whatIsHappening, {}))?.nothingYet).toBe(false)
  })

  it('answers nothing at all to somebody the ledger does not know', async () => {
    const t = convexWithTheDashboard()
    await t.run(twoHouses)

    expect(
      await t.withIdentity({ subject: 'user_stranger' }).query(api.dashboard.queries.whatIsHappening, {})
    ).toBeNull()

    // The control: the same call from a known sign-in comes back with the ledger in it, so the null above is the check and not an empty database.
    expect((await signedIn(t).query(api.dashboard.queries.whatIsHappening, {}))?.houses).toHaveLength(2)
  })
})
