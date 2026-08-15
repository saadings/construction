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

describe('one person’s account', () => {
  it('reads in the order the money happened, with the balance after each line', async () => {
    // The `MR FARAN ACCOUNT` sheet: billed, paid, and the column somebody runs a finger down.
    const t = convexWithOwed()
    const steel = await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 600_000_00)
      await pay(ctx, at, at.first, at.steel, 250_000_00)
      return at.steel
    })

    const read = await signedIn(t).query(api.owed.queries.statement, { personId: steel })
    // Newest first on the way out, so the balances read downwards from the latest.
    expect(read?.account?.lines.map((line) => [line.what, line.amountPaisa, line.balancePaisa])).toEqual([
      ['paid', 250_000_00, 350_000_00],
      ['billed', 600_000_00, 600_000_00],
    ])
    expect(read?.account?.billedPaisa).toBe(600_000_00)
    expect(read?.account?.paidPaisa).toBe(250_000_00)
  })

  it('is one account across every house, and says which house each line was on', async () => {
    const t = convexWithOwed()
    const steel = await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 600_000_00)
      await bill(ctx, at, at.second, at.steel, 400_000_00)
      return at.steel
    })

    const read = await signedIn(t).query(api.owed.queries.statement, { personId: steel })

    expect(read?.account?.lines.map((line) => line.onWhichHouse).sort()).toEqual(['1-A, Phase 0', '2-B, Phase 0'])
    expect(read?.account?.billedPaisa).toBe(1_000_000_00)
  })

  it('runs the balance below nothing when they are holding an advance', async () => {
    // Common enough in the workbooks that a credit has to read as an ordinary position rather than as an error.
    const t = convexWithOwed()
    const mason = await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.mason, 100_000_00)
      await pay(ctx, at, at.first, at.mason, 250_000_00)
      return at.mason
    })

    const read = await signedIn(t).query(api.owed.queries.statement, { personId: mason })

    expect(read?.account?.lines[0]?.balancePaisa).toBe(-150_000_00)
  })

  it('leaves out what was taken back out, from both sides', async () => {
    const t = convexWithOwed()
    const steel = await t.run(async (ctx) => {
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
      await ctx.db.insert('payments', {
        siteId: at.first,
        tradeId: at.trade,
        paidToId: at.steel,
        day: '2026-04-02',
        amountPaisa: 700_000_00,
        method: 'cash',
        isExtraWork: false,
        removed: true,
        addedByExternalId: SIGNED_IN_AS,
      })
      return at.steel
    })

    const read = await signedIn(t).query(api.owed.queries.statement, { personId: steel })

    expect(read?.account?.lines).toHaveLength(1)
    expect(read?.account?.billedPaisa).toBe(500_000_00)
    expect(read?.account?.paidPaisa).toBe(0)
  })

  it('puts a bill and a payment alike in day and amount in the order they were written, not bills first', async () => {
    // The two sides are read from two tables and joined. Without something steady deciding the tie, the order is whichever array they were pushed from -- so a payment made before a bill would sort after it, and the balance column would read backwards for those two lines.
    const t = convexWithOwed()
    const steel = await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)

      // The payment first, so array order and written order disagree.
      await pay(ctx, at, at.first, at.steel, 300_000_00)
      await ctx.db.insert('bills', {
        siteId: at.first,
        personId: at.steel,
        tradeId: at.trade,
        // The same day the payment carries, so the day cannot be what separates them.
        day: '2026-04-02',
        amountPaisa: 300_000_00,
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })

      return at.steel
    })

    const read = await signedIn(t).query(api.owed.queries.statement, { personId: steel })

    // Newest first on the way out, so the one written second is at the top.
    expect(read?.account?.lines.map((line) => line.what)).toEqual(['billed', 'paid'])
    expect(read?.account?.lines.map((line) => line.balancePaisa)).toEqual([0, -300_000_00])
  })

  it('says nobody rather than a statement of zeroes, for a person who has been taken off the list', async () => {
    const t = convexWithOwed()
    const gone = await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await ctx.db.delete('people', at.mason)
      return at.mason
    })

    const read = await signedIn(t).query(api.owed.queries.statement, { personId: gone })

    // An answer holding no account, which is a different thing from the reading below.
    expect(read).toEqual({ account: null })
  })

  it('answers nothing at all to somebody the ledger does not know', async () => {
    // The two unknowns kept apart: nothing means the ledger has never seen this sign-in, and an answer holding no account means nobody by that name.
    const t = convexWithOwed()
    const steel = await t.run(async (ctx) => {
      const at = await twoHousesAndTwoTrades(ctx)
      await bill(ctx, at, at.first, at.steel, 500_000_00)
      return at.steel
    })

    expect(
      await t.withIdentity({ subject: 'user_stranger' }).query(api.owed.queries.statement, { personId: steel })
    ).toBeNull()

    // The control: the same call from a known sign-in comes back with the account in it.
    expect((await signedIn(t).query(api.owed.queries.statement, { personId: steel }))?.account?.name).toBe(
      'A steel supplier'
    )
  })
})
