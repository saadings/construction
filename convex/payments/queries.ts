import { ConvexError } from 'convex/values'

import type { Doc, Id } from '../_generated/dataModel'
import type { SiteQueryCtx } from '../utils/siteAccess'
import { siteQuery } from '../utils/siteAccess'

// Everything still standing on this site. Removed payments are read back nowhere, but they are still there to settle an argument with.
async function standingOn(ctx: SiteQueryCtx): Promise<Array<Doc<'payments'>>> {
  const all = await ctx.db
    .query('payments')
    .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
    .collect()

  return all.filter((payment) => !payment.removed)
}

// Newest first, because a day sheet is checked against what was just put in rather than against the beginning of the house.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const standing = await standingOn(ctx)

    // The day carries no time, and a cheque run puts eight payments on one day. What separates them is written down rather than left to whichever order the rows came back in, so the list reads the same twice.

    // Largest first, because that is the one being looked for. The id settles the rest: two payments alike in day and amount are the same thing to anyone reading them, so the last step only has to be steady.
    return standing.sort(
      (one, other) =>
        other.day.localeCompare(one.day) || other.amountPaisa - one.amountPaisa || one._id.localeCompare(other._id)
    )
  },
})

// Every figure here is the sum of the rows behind it. There is nowhere to type one, which is the whole difference from the workbooks.
export const totals = siteQuery({
  handler: async (ctx) => {
    const standing = await standingOn(ctx)

    const paisaByTrade = new Map<Id<'trades'>, number>()
    for (const payment of standing) {
      paisaByTrade.set(payment.tradeId, (paisaByTrade.get(payment.tradeId) ?? 0) + payment.amountPaisa)
    }

    const byTrade = []
    let buildingCostPaisa = 0
    let plotCostPaisa = 0

    for (const [tradeId, paisa] of paisaByTrade) {
      const trade = await ctx.db.get('trades', tradeId)
      // Trades are hidden, never deleted, so this cannot happen; if it ever does, a figure would go missing quietly and that is the one thing this must not do.
      if (trade === null) {
        throw new ConvexError('Something is missing from the trade list on this site.')
      }

      // The flag decides, never the name. Renaming a trade must not move money from one side of the line to the other.
      if (trade.countsAsBuildingCost) {
        buildingCostPaisa += paisa
      } else {
        plotCostPaisa += paisa
      }

      byTrade.push({ tradeId, name: trade.name, paisa })
    }

    // Biggest spend first, and two trades that come to the same figure read alphabetically rather than in whichever order their first payment happened to be written.
    byTrade.sort((one, other) => other.paisa - one.paisa || one.name.localeCompare(other.name))

    return {
      byTrade,
      buildingCostPaisa,
      plotCostPaisa,
      // Not a third sum: the two above are every payment on the site, split in two, and this says so out loud.
      spentPaisa: buildingCostPaisa + plotCostPaisa,
    }
  },
})
