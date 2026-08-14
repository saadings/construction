import { internalMutation } from '../_generated/server'
import { CANONICAL_TRADES } from './seed'

// Matches on name, so running it twice never doubles the list: "first run" happens on three deployments and more than once on each, and an existing row is brought into line rather than left behind.
export const seed = internalMutation({
  // Declaring no arguments is declaring an empty set of them.
  args: {},
  handler: async (ctx) => {
    let added = 0
    let corrected = 0

    for (const [position, trade] of CANONICAL_TRADES.entries()) {
      const existing = await ctx.db
        .query('trades')
        .withIndex('byName', (q) => q.eq('name', trade.name))
        .unique()

      if (existing === null) {
        await ctx.db.insert('trades', { ...trade, position, hidden: false })
        added += 1
        continue
      }

      // `hidden` is left alone: hiding a trade is a decision someone made here, not something the list should undo.
      if (existing.countsAsBuildingCost !== trade.countsAsBuildingCost || existing.position !== position) {
        await ctx.db.patch('trades', existing._id, {
          countsAsBuildingCost: trade.countsAsBuildingCost,
          position,
        })
        corrected += 1
      }
    }

    return { added, corrected, total: CANONICAL_TRADES.length }
  },
})
