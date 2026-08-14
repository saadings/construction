// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { internal } from '../_generated/api'
import schema from '../schema'
import { CANONICAL_TRADES } from './seed'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithTrades() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../trades/mutations.ts': () => import('./mutations'),
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
