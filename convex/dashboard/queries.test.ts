// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { theDaysWithNothingOnThem, theMonthsEndingWith } from './queries'

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'

// The day every reading below is asked for. Fixed rather than today's: this query answers `this month`, `the last six months` and `the days nothing was entered on`, and every one of those is a different answer tomorrow.

// The last day of the month the fixture's rows fall in, so `this month` holds them and the quiet-day count is a run somebody could have missed.
const TODAY = '2026-04-30'

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

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

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

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

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

    const dashboard = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })
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

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })
    const shown = read?.whereItWent ?? []

    expect(shown).toHaveLength(7)
    expect(shown[6].name).toBe('Everything else (3)')
    // Every rupee is on the chart. The gathered tail and the six named come to what the tile above the chart says went out this month.
    expect(shown.reduce((total, one) => total + one.paisa, 0)).toBe(read?.thisMonth.paidOutPaisa)
  })

  it('asks the category chart about this month rather than about the whole ledger', async () => {
    // His heading says `By category, March 2025`. Where the money has gone since the beginning is a different question with its own screen, and a chart headed with a month while holding every month is the quietest way for a screen to be wrong.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await paid(ctx, at, { day: '2026-04-11', amountPaisa: 300_000_00 })
      await paid(ctx, at, { day: '2026-02-11', tradeId: at.cement, amountPaisa: 900_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    expect(read?.whereItWent.map((one) => [one.name, one.paisa])).toEqual([['Steel', 300_000_00]])
    expect(read?.thisMonth.paidOutPaisa).toBe(300_000_00)
    // The February payment is not lost, it is simply not this month's: the lifetime figure still holds both.
    expect(read?.goneOutPaisa).toBe(1_200_000_00)
  })

  it('counts the entries behind what went out this month', async () => {
    // His `Across 47 entries`. It is what tells him whether a heavy month was one cheque or forty, and a figure that doubled says nothing about why without it.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await paid(ctx, at, { day: '2026-04-11', amountPaisa: 300_000_00 })
      await paid(ctx, at, { day: '2026-04-12', amountPaisa: 400_000_00 })
      await paid(ctx, at, { day: '2026-04-13', amountPaisa: 500_000_00, removed: true })
      await paid(ctx, at, { day: '2026-03-30', amountPaisa: 600_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    // Two: last month's is not this month's, and one taken back out was never an entry.
    expect(read?.thisMonth.entries).toBe(2)
    expect(read?.thisMonth.paidOutPaisa).toBe(700_000_00)
  })

  it('says what came in this month, apart from what has come in altogether', async () => {
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await cameIn(ctx, at, { day: '2026-04-03', amountPaisa: 500_000_00 })
      await cameIn(ctx, at, { day: '2026-01-03', amountPaisa: 700_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    expect(read?.thisMonth.receivedPaisa).toBe(500_000_00)
    expect(read?.comeIn.receivedPaisa).toBe(1_200_000_00)
  })

  it('counts the people owed something, and nobody holding an advance', async () => {
    // His caption under the payables tile. An advance is a real position and not somebody owed, so counting the rows rather than the positive ones would say four people are owed money when three are.
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
      await paid(ctx, at, { paidToId: at.client, amountPaisa: 150_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    expect(read?.owed.people).toBe(1)
    expect(read?.owed.advancedPaisa).toBe(150_000_00)
  })

  it('puts what came in against what went out, over six months ending with this one', async () => {
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await cameIn(ctx, at, { day: '2026-03-15', why: 'partnerMoney', fromId: at.partner, amountPaisa: 200_000_00 })
      await cameIn(ctx, at, { day: '2026-04-01', why: 'clientPayment', amountPaisa: 500_000_00 })
      await paid(ctx, at, { day: '2026-04-20', amountPaisa: 300_000_00 })
      // Older than the window. It is still in the lifetime figures and it is not one of his six columns.
      await cameIn(ctx, at, { day: '2025-09-09', why: 'sale', amountPaisa: 900_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    // Six of them, oldest first, whether or not anything happened in each -- a chart drawn from the rows alone skips a month nothing happened in, which is the month worth seeing.
    expect(read?.inAndOut).toEqual([
      { month: '2025-11', inPaisa: 0, outPaisa: 0 },
      { month: '2025-12', inPaisa: 0, outPaisa: 0 },
      { month: '2026-01', inPaisa: 0, outPaisa: 0 },
      { month: '2026-02', inPaisa: 0, outPaisa: 0 },
      { month: '2026-03', inPaisa: 200_000_00, outPaisa: 0 },
      { month: '2026-04', inPaisa: 500_000_00, outPaisa: 300_000_00 },
    ])

    // And the September receipt is not lost, it is outside the window.
    expect(read?.comeIn.receivedPaisa).toBe(1_600_000_00)
  })

  it('wraps a year without a special case', () => {
    // The arithmetic that names the six months, asked directly. It counts on a number of months rather than stepping a `Date`, so no timezone can move one -- and December to January is the one place an off-by-one hides.
    expect(theMonthsEndingWith('2026-02', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
    expect(theMonthsEndingWith('2026-01', 2)).toEqual(['2025-12', '2026-01'])
    expect(theMonthsEndingWith('2026-12', 1)).toEqual(['2026-12'])
  })

  it('names the days in the last week that nothing was recorded on', async () => {
    // The one row of `Needs your attention` this ledger can answer. His other two need a due date on a bill and an estimate on a site, and neither field exists.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      // Older than the week, so the whole window is inside a ledger that already existed.
      await paid(ctx, at, { day: '2026-03-30', amountPaisa: 50_000_00 })
      await paid(ctx, at, { day: '2026-04-24', amountPaisa: 100_000_00 })
      await cameIn(ctx, at, { day: '2026-04-27', amountPaisa: 200_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: '2026-04-28' })

    // The seven days before the 28th, less the two that have something on them. The 28th itself is not in it: a day is not missing until it is over.
    expect(read?.quietDays).toEqual(['2026-04-21', '2026-04-22', '2026-04-23', '2026-04-25', '2026-04-26'])
  })

  it('does not accuse him of missing the days before the ledger existed', async () => {
    // A ledger started this afternoon has a week of days with nothing on them, and every one of them is a day nobody could have entered anything on. Greeting him with that on day one is the opposite of what the row is for.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await paid(ctx, at, { day: '2026-04-27', amountPaisa: 100_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: '2026-04-28' })

    expect(read?.quietDays).toEqual([])
  })

  it('steps the days back without a timezone moving one', () => {
    // Asked directly, and across a month boundary, because the failure this cannot have is a day that is off by one -- which is what building a day at local midnight does for everybody east of UTC, which is everybody using this.
    expect(theDaysWithNothingOnThem('2026-03-03', ['2026-02-26', '2026-03-01'], 5)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-02',
    ])

    // The cut-off asked on its own: the same window, with the ledger starting inside it. The 26th and 27th are not days he missed.
    expect(theDaysWithNothingOnThem('2026-03-03', ['2026-02-28'], 5)).toEqual(['2026-03-01', '2026-03-02'])

    // And a day it cannot read is no days rather than a week of wrong ones.
    expect(theDaysWithNothingOnThem('sometime', ['2026-03-01'], 4)).toEqual([])
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

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

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

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    // Most spent first: the house taking the money is the house he is thinking about.
    expect(read?.houses.map((house) => [house.name, house.goneOutPaisa, house.comeInPaisa])).toEqual([
      ['2-B, Phase 0', 800_000_00, 0],
      ['1-A, Phase 0', 100_000_00, 500_000_00],
    ])
  })

  it('says who a house is going up for, and how big it is, for the line under its name', async () => {
    // His subtitle: `For Adnan Sheikh · 5,400 sqft`. A client is a capacity somebody holds on one house rather than a field on the house, so this is the roles table -- and a house built to sell has nobody to name.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await ctx.db.patch('sites', at.first, { coveredAreaSqft: 5400 })
      await ctx.db.patch('sites', at.second, { builtForAClient: false })
      await ctx.db.insert('siteRoles', { siteId: at.first, personId: at.client, capacity: 'client' })
      // A partner on the same house, who is not who it is for.
      await ctx.db.insert('siteRoles', { siteId: at.first, personId: at.partner, capacity: 'partner' })
      // And a client named on the house that is not built for one, which must not reach the screen.
      await ctx.db.insert('siteRoles', { siteId: at.second, personId: at.client, capacity: 'client' })
      await paid(ctx, at, { siteId: at.first, amountPaisa: 100_000_00 })
    })

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    expect(
      read?.houses.map((house) => [house.name, house.builtForAClient, house.forWhom, house.coveredAreaSqft])
    ).toEqual([
      ['1-A, Phase 0', true, 'The one it is built for', 5400],
      // Both halves, because `forWhom: null` on its own cannot tell a house going up to sell from a house whose client nobody has entered -- and the screen says a different sentence for each.
      ['2-B, Phase 0', false, null, null],
    ])
  })

  it('hands back the day it was asked for', async () => {
    // The heading says which day the figures are as at, and it says it from here rather than reading the clock again on the screen. Two clocks is how a heading comes to name a different day from the figures under it.
    const t = convexWithTheDashboard()
    await t.run(twoHouses)

    expect((await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY }))?.asAt).toBe(TODAY)
  })

  it('says plainly when nothing has been put in yet', async () => {
    // His first day: one house and nothing in it. A dashboard that draws charts over four zeroes is what everybody ships, so the screen is told rather than left to work it out.
    const t = convexWithTheDashboard()
    await t.run(twoHouses)

    const read = await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY })

    expect(read?.nothingYet).toBe(true)
    expect(read?.houses).toHaveLength(2)
    expect(read?.whereItWent).toEqual([])
    expect(read?.quietDays).toEqual([])
    // Six months of nothing rather than no months. The window is a window whether or not anything landed in it, and the screen draws a different thing entirely on this day.
    expect(read?.inAndOut.map((one) => one.inPaisa + one.outPaisa)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('stops saying so the moment anything is put in', async () => {
    // The control. A flag that is always true is not a flag.
    const t = convexWithTheDashboard()
    await t.run(async (ctx) => {
      const at = await twoHouses(ctx)
      await cameIn(ctx, at, { amountPaisa: 1_00 })
    })

    expect((await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY }))?.nothingYet).toBe(false)
  })

  it('answers nothing at all to somebody the ledger does not know', async () => {
    const t = convexWithTheDashboard()
    await t.run(twoHouses)

    expect(
      await t.withIdentity({ subject: 'user_stranger' }).query(api.dashboard.queries.whatIsHappening, { today: TODAY })
    ).toBeNull()

    // The control: the same call from a known sign-in comes back with the ledger in it, so the null above is the check and not an empty database.
    expect((await signedIn(t).query(api.dashboard.queries.whatIsHappening, { today: TODAY }))?.houses).toHaveLength(2)
  })
})
