// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api, internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { CANONICAL_TRADES } from './seed'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithTrades() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../trades/mutations.ts': () => import('./mutations'),
    '../trades/queries.ts': () => import('./queries'),
  })
}

describe('putting the trade list on a deployment', () => {
  it('puts every trade there once', async () => {
    const t = convexWithTrades()

    const first = await t.mutation(internal.trades.mutations.seed, {})

    expect(first.added).toBe(CANONICAL_TRADES.length)
    expect(await t.run((ctx) => ctx.db.query('trades').collect())).toHaveLength(CANONICAL_TRADES.length)
  })

  it('does not put them there twice', async () => {
    // "First run" happens on three deployments and more than once on each. Twice must not mean ninety-six trades.
    const t = convexWithTrades()

    await t.mutation(internal.trades.mutations.seed, {})
    const again = await t.mutation(internal.trades.mutations.seed, {})

    expect(again.added).toBe(0)
    expect(again.corrected).toBe(0)
    expect(await t.run((ctx) => ctx.db.query('trades').collect())).toHaveLength(CANONICAL_TRADES.length)
  })

  it('brings a trade that has drifted back into line', async () => {
    // A deployment seeded before the plot bucket became three would otherwise keep counting the land as building cost forever.
    const t = convexWithTrades()
    await t.mutation(internal.trades.mutations.seed, {})

    await t.run(async (ctx) => {
      const plot = await ctx.db
        .query('trades')
        .withIndex('byName', (q) => q.eq('name', 'Plot'))
        .unique()
      if (!plot) throw new Error('the seeded list has no trade called Plot')

      await ctx.db.patch('trades', plot._id, { countsAsBuildingCost: true, hidden: true })
    })

    const again = await t.mutation(internal.trades.mutations.seed, {})

    expect(again.corrected).toBe(1)
    const plot = await t.run((ctx) =>
      ctx.db
        .query('trades')
        .withIndex('byName', (q) => q.eq('name', 'Plot'))
        .unique()
    )
    expect(plot?.countsAsBuildingCost).toBe(false)
    // Hiding a trade is a decision someone made here. Bringing the list into line must not undo it.
    expect(plot?.hidden).toBe(true)
  })
})

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'

async function aSignIn(ctx: MutationCtx) {
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })
}

const signedIn = (t: ReturnType<typeof convexWithTrades>) => t.withIdentity({ subject: SIGNED_IN_AS })

describe('what money is spent on', () => {
  it('puts a new one after the list a deployment starts with, not into the middle of it', async () => {
    // A house is built in roughly the seeded order, and dropping a new trade into the middle of it moves everything he already knows the position of.
    const t = convexWithTrades()
    await t.run(aSignIn)
    await t.mutation(internal.trades.mutations.seed, {})

    const tradeId = await signedIn(t).mutation(api.trades.mutations.add, {
      name: 'Scaffolding',
      countsAsBuildingCost: true,
    })

    const everything = await t.run((ctx) => ctx.db.query('trades').collect())
    const added = everything.find((trade) => trade._id === tradeId)
    expect(added?.position).toBe(Math.max(...everything.map((trade) => trade.position)))
    const asPicked = (await signedIn(t).query(api.trades.queries.list, {})) ?? []
    expect(asPicked[asPicked.length - 1]?.name).toBe('Scaffolding')
  })

  it('refuses one that is already there, saying which, however it was typed', async () => {
    // Two rows for one trade split a house's spending across both, and the building cost is then wrong and quietly so.
    const t = convexWithTrades()
    await t.run(aSignIn)
    await signedIn(t).mutation(api.trades.mutations.add, { name: 'Scaffolding', countsAsBuildingCost: true })

    for (const typed of ['Scaffolding', 'scaffolding', '  SCAFFOLDING  ']) {
      expect(
        await refusalFrom(signedIn(t).mutation(api.trades.mutations.add, { name: typed, countsAsBuildingCost: true }))
      ).toBe('Scaffolding is already on the list.')
    }

    expect(await t.run((ctx) => ctx.db.query('trades').collect())).toHaveLength(1)
  })

  it('brings back one that was taken off, keeping where it sat', async () => {
    const t = convexWithTrades()
    await t.run(aSignIn)
    await t.mutation(internal.trades.mutations.seed, {})

    const bricks = (await t.run((ctx) => ctx.db.query('trades').collect())).find((trade) => trade.name === 'Bricks')
    if (bricks === undefined) {
      throw new Error('The seeded list has no Bricks, so this test is about nothing.')
    }

    await signedIn(t).mutation(api.trades.mutations.hide, { tradeId: bricks._id })
    expect((await signedIn(t).query(api.trades.queries.list, {}))?.map((trade) => trade.name)).not.toContain('Bricks')

    const again = await signedIn(t).mutation(api.trades.mutations.add, {
      name: 'bricks',
      countsAsBuildingCost: true,
    })

    // The same row, at the position it always had, so a payment already pointing at it still does.
    expect(again).toBe(bricks._id)
    expect(await t.run((ctx) => ctx.db.get('trades', bricks._id))).toMatchObject({
      position: bricks.position,
      hidden: false,
      name: 'bricks',
    })
  })

  it('says whether it is building cost, because that is what a house cost', async () => {
    // Buying the land is money spent and is not building. The true ones added together are the building cost.
    const t = convexWithTrades()
    await t.run(aSignIn)

    const tradeId = await signedIn(t).mutation(api.trades.mutations.add, {
      name: 'Society transfer fee',
      countsAsBuildingCost: false,
    })

    expect(await t.run((ctx) => ctx.db.get('trades', tradeId))).toMatchObject({ countsAsBuildingCost: false })

    await signedIn(t).mutation(api.trades.mutations.edit, {
      tradeId,
      name: 'Society transfer fee',
      countsAsBuildingCost: true,
    })
    expect(await t.run((ctx) => ctx.db.get('trades', tradeId))).toMatchObject({ countsAsBuildingCost: true })
  })

  it('will not rename one onto a name that is taken', async () => {
    const t = convexWithTrades()
    await t.run(aSignIn)
    await signedIn(t).mutation(api.trades.mutations.add, { name: 'Scaffolding', countsAsBuildingCost: true })
    const other = await signedIn(t).mutation(api.trades.mutations.add, {
      name: 'Shuttering',
      countsAsBuildingCost: true,
    })

    expect(
      await refusalFrom(
        signedIn(t).mutation(api.trades.mutations.edit, {
          tradeId: other,
          name: 'Scaffolding',
          countsAsBuildingCost: true,
        })
      )
    ).toBe('Scaffolding is already on the list.')

    // And one may still be corrected without its name changing, which is most corrections.
    await signedIn(t).mutation(api.trades.mutations.edit, {
      tradeId: other,
      name: 'Shuttering',
      countsAsBuildingCost: false,
    })
    expect(await t.run((ctx) => ctx.db.get('trades', other))).toMatchObject({ countsAsBuildingCost: false })
  })

  it('takes one off the list and leaves it where the payments can still find it', async () => {
    const t = convexWithTrades()
    await t.run(aSignIn)
    const tradeId = await signedIn(t).mutation(api.trades.mutations.add, {
      name: 'Scaffolding',
      countsAsBuildingCost: true,
    })

    await signedIn(t).mutation(api.trades.mutations.hide, { tradeId })

    expect(await signedIn(t).query(api.trades.queries.list, {})).toEqual([])
    // Hidden, never deleted: a trade that vanishes turns spent money into money spent on nothing.
    expect(await t.run((ctx) => ctx.db.get('trades', tradeId))).toMatchObject({ hidden: true })
  })

  it('turns away a caller who is not signed in', async () => {
    const t = convexWithTrades()

    await expect(
      t.mutation(api.trades.mutations.add, { name: 'Scaffolding', countsAsBuildingCost: true })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('trades').collect())).toEqual([])
  })
})
