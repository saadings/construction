import { ConvexError, v } from 'convex/values'

import { sameTrade, sayTheTradeIsThere, tradeInput } from '../../shared/validation/trade'
import type { Doc } from '../_generated/dataModel'
import { internalMutation } from '../_generated/server'
import { checked } from '../utils/checked'
import type { LedgerMutationCtx } from '../utils/ledgerAccess'
import { ledgerMutation } from '../utils/ledgerAccess'
import { CANONICAL_TRADES } from './seed'

const typedIn = { name: v.string(), countsAsBuildingCost: v.boolean() }

// Read whole rather than through `byName`, because the index answers about the name exactly as typed and the same trade is the same trade in any case and any spacing.
async function whatIsAlreadyCalled(ctx: LedgerMutationCtx, name: string): Promise<Doc<'trades'> | null> {
  const everything = await ctx.db.query('trades').withIndex('byName').collect()

  return everything.find((trade) => sameTrade(trade.name, name)) ?? null
}

// The seeded list is the forty-five the workbooks accumulated, in the order the work happens. One he adds goes after them: a house is built in roughly that order, and dropping a new trade into the middle of it would move everything he already knows the position of.
export const add = ledgerMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const trade = checked(tradeInput, args)
    const already = await whatIsAlreadyCalled(ctx, trade.name)

    if (already === null) {
      const everything = await ctx.db.query('trades').withIndex('byName').collect()

      return await ctx.db.insert('trades', {
        ...trade,
        position: everything.reduce((furthest, one) => Math.max(furthest, one.position), 0) + 1,
        hidden: false,
      })
    }

    // Taken off the list is not gone, and refusing here would hold the name against something he cannot see. Putting it back keeps its position and every payment already pointing at it.
    if (already.hidden) {
      await ctx.db.patch('trades', already._id, { ...trade, hidden: false })

      return already._id
    }

    throw new ConvexError(sayTheTradeIsThere(already.name))
  },
})

// The name and whether it is building cost, together: they are the two things a trade is, and the second decides what a house cost.
export const edit = ledgerMutation({
  args: { tradeId: v.id('trades'), ...typedIn },
  handler: async (ctx, args) => {
    const trade = checked(tradeInput, args)
    const already = await whatIsAlreadyCalled(ctx, trade.name)

    if (already !== null && already._id !== args.tradeId) {
      throw new ConvexError(sayTheTradeIsThere(already.name))
    }

    await ctx.db.patch('trades', args.tradeId, trade)
  },
})

// Hidden, never deleted: payments point at a trade forever, and one that vanishes turns spent money into money spent on nothing.
export const hide = ledgerMutation({
  args: { tradeId: v.id('trades') },
  handler: async (ctx, { tradeId }) => {
    await ctx.db.patch('trades', tradeId, { hidden: true })
  },
})

// Matches on name, so running it twice never doubles the list: "first run" happens on three deployments and more than once on each, and an existing row is brought into line rather than left behind.

// not-from-a-screen: the list of trades every house starts with, written once when a deployment is empty
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
