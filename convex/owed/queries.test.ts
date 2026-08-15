// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_partner'

function convexWithOwed() {
  return convexTest(schema, { ...import.meta.glob('../**/*.*s'), '../owed/queries.ts': () => import('./queries') })
}

type TwoHouses = {
  first: Id<'sites'>
  second: Id<'sites'>
  steel: Id<'people'>
  mason: Id<'people'>
  trade: Id<'trades'>
}

// Two houses on purpose: a supplier delivering to both has one balance, and a per-site reading would show two halves nobody adds up.
async function twoHousesAndTwoTrades(ctx: MutationCtx): Promise<TwoHouses> {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const steel = await ctx.db.insert('people', { name: 'A steel supplier', hidden: false })
  const mason = await ctx.db.insert('people', { name: 'A mason', hidden: false })

  const house = async (name: string) =>
    await ctx.db.insert('sites', { name, builtForAClient: false, stage: 'building', hidden: false })

  const first = await house('1-A, Phase 0')
  const second = await house('2-B, Phase 0')
  const trade = await ctx.db.insert('trades', { name: 'Steel', countsAsBuildingCost: true, position: 1, hidden: false })

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
    personId: partner,
  })

  return { first, second, steel, mason, trade }
}

async function bill(ctx: MutationCtx, at: TwoHouses, siteId: Id<'sites'>, personId: Id<'people'>, paisa: number) {
  await ctx.db.insert('bills', {
    siteId,
    personId,
    tradeId: at.trade,
    day: '2026-04-01',
    amountPaisa: paisa,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })
}

async function pay(ctx: MutationCtx, at: TwoHouses, siteId: Id<'sites'>, paidToId: Id<'people'>, paisa: number) {
  await ctx.db.insert('payments', {
    siteId,
    tradeId: at.trade,
    paidToId,
    paidById: at.mason,
    day: '2026-04-02',
    amountPaisa: paisa,
    method: 'cheque',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })
}

const signedIn = (t: ReturnType<typeof convexWithOwed>) => t.withIdentity({ subject: SIGNED_IN_AS })

describe('what each person is owed', () => {
  it('is one balance across every house, not one for each', async () => {
    // The whole reason this is not a site query: a supplier on two houses has one account.
    const t = convexWithOwed()
    await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 600_000_00)
      await bill(ctx, at, at.second, at.steel, 400_000_00)
      await pay(ctx, at, at.first, at.steel, 250_000_00)
    })

    const read = await signedIn(t).query(api.owed.queries.position, {})
    const supplier = read?.everyone.find((one) => one.name === 'A steel supplier')

    expect(supplier?.billedPaisa).toBe(1_000_000_00)
    expect(supplier?.paidPaisa).toBe(250_000_00)
    expect(supplier?.outstandingPaisa).toBe(750_000_00)
    // 400,000 still owed on the second house and 350,000 on the first, largest first, so the one balance can be explained without anyone adding up.
    expect(supplier?.onHouses.map((house) => house.outstandingPaisa)).toEqual([400_000_00, 350_000_00])
  })

  it('shows an advance as a negative balance rather than as nothing', async () => {
    const t = convexWithOwed()
    await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.mason, 100_000_00)
      await pay(ctx, at, at.first, at.mason, 250_000_00)
    })

    const read = await signedIn(t).query(api.owed.queries.position, {})
    const mason = read?.everyone.find((one) => one.name === 'A mason')

    expect(mason?.outstandingPaisa).toBe(-150_000_00)
  })

  it('keeps what is owed and what is held apart, and never nets them', async () => {
    // A single figure would read 600,000 here and hide that one man is owed 750,000 today.
    const t = convexWithOwed()
    await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 750_000_00)
      await bill(ctx, at, at.first, at.mason, 100_000_00)
      await pay(ctx, at, at.first, at.mason, 250_000_00)
    })

    const read = await signedIn(t).query(api.owed.queries.position, {})

    expect(read?.payablePaisa).toBe(750_000_00)
    expect(read?.advancedPaisa).toBe(150_000_00)
    expect((read?.payablePaisa ?? 0) - (read?.advancedPaisa ?? 0)).not.toBe(read?.payablePaisa)
  })

  it('leaves out what was taken back out, on either side', async () => {
    const t = convexWithOwed()
    await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 500_000_00)
      await ctx.db.insert('bills', {
        siteId: at.first,
        personId: at.steel,
        tradeId: at.trade,
        day: '2026-04-01',
        amountPaisa: 900_000_00,
        removed: true,
        addedByExternalId: SIGNED_IN_AS,
      })
    })

    const read = await signedIn(t).query(api.owed.queries.position, {})

    expect(read?.everyone.find((one) => one.name === 'A steel supplier')?.billedPaisa).toBe(500_000_00)
  })

  it('counts a payment to nobody against nobody', async () => {
    // Money handed over at a shop is the site's cost and no one's account. It has no payee to hang on.
    const t = convexWithOwed()
    await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await ctx.db.insert('payments', {
        siteId: at.first,
        tradeId: at.trade,
        paidById: at.mason,
        day: '2026-04-02',
        amountPaisa: 50_000_00,
        method: 'cash',
        isExtraWork: false,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
    })

    const read = await signedIn(t).query(api.owed.queries.position, {})

    expect(read?.everyone).toEqual([])
    expect(read?.payablePaisa).toBe(0)
  })

  it('reads the same however the rows went in', async () => {
    // Two people owed the same thing must not swap places between readings, which is what a person reconciling against a cheque book would see as the list changing under him.
    const both = []
    for (const order of [
      ['A steel supplier', 'A mason'],
      ['A mason', 'A steel supplier'],
    ]) {
      const t = convexWithOwed()
      await t.run(async (ctx) => {
        const at = await twoHousesAndTwoTrades(ctx)
        for (const who of order) {
          await bill(ctx, at, at.first, who === 'A mason' ? at.mason : at.steel, 300_000_00)
        }
      })

      const read = await signedIn(t).query(api.owed.queries.position, {})
      both.push(read?.everyone.map((one) => one.name) ?? [])
    }

    expect(both[0]).toEqual(both[1])
    expect(both[0]).toEqual(['A mason', 'A steel supplier'])
  })

  it('answers nothing at all to somebody the ledger does not know', async () => {
    // A reading refuses by answering nothing rather than by throwing, the same shape a site read has. Nothing and an empty ledger look alike, which is why the control below matters.
    const t = convexWithOwed()
    await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 500_000_00)
    })

    expect(await t.withIdentity({ subject: 'user_stranger' }).query(api.owed.queries.position, {})).toBeNull()

    // The control: the same call from a known sign-in comes back with the ledger in it, so the null above is the check and not an empty database.
    const known = await signedIn(t).query(api.owed.queries.position, {})
    expect(known?.payablePaisa).toBe(500_000_00)
  })
})
