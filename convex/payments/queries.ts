import { ConvexError, v } from 'convex/values'

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

// What went on one trade, in the words somebody reads them in: who was paid, when, how much, and how. A figure on the house page is a sum, and this is what it is a sum of -- which is where a wrong one is found and taken out.
export const onTrade = siteQuery({
  args: { tradeId: v.id('trades') },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('payments')
      .withIndex('bySiteAndTrade', (q) => q.eq('siteId', ctx.siteId).eq('tradeId', args.tradeId))
      .collect()

    const standing = all.filter((payment) => !payment.removed)

    const rows = []
    for (const payment of standing) {
      // Absent for a one-off shop nobody will be paid again, which is why this is a name and not a person.
      const paidTo = payment.paidToId === undefined ? null : await ctx.db.get('people', payment.paidToId)

      rows.push({
        _id: payment._id,
        day: payment.day,
        amountPaisa: payment.amountPaisa,
        paidToName: paidTo?.name ?? 'A one-off',
        method: payment.method,
        reference: payment.reference,
        note: payment.note,
      })
    }

    // Newest first, and steady: a cheque run puts eight on one day, so what separates them is written down rather than left to whichever order the rows came back in.
    return rows.sort(
      (one, other) =>
        other.day.localeCompare(one.day) || other.amountPaisa - one.amountPaisa || one._id.localeCompare(other._id)
    )
  },
})

// The last few payments on this house, as the drawn `Latest entries` card shows them: a day, what it was for, who was paid, and how much. It is the day sheet's own rows read from the house rather than from the day, which is why it carries no way to change one -- what it offers instead is the way through to the sheet that does.
const HOW_MANY_IS_LATEST = 5

export const latest = siteQuery({
  handler: async (ctx) => {
    const standing = await standingOn(ctx)

    // Newest first, and steady on the ties for the same reason `onTrade` is: a cheque run puts eight on one day and the order they came back in is not an order.
    const newestFirst = standing.sort(
      (one, other) =>
        other.day.localeCompare(one.day) || other.amountPaisa - one.amountPaisa || one._id.localeCompare(other._id)
    )

    const rows = []
    for (const payment of newestFirst.slice(0, HOW_MANY_IS_LATEST)) {
      const [trade, paidTo] = await Promise.all([
        ctx.db.get('trades', payment.tradeId),
        payment.paidToId === undefined ? Promise.resolve(null) : ctx.db.get('people', payment.paidToId),
      ])

      rows.push({
        _id: payment._id,
        day: payment.day,
        amountPaisa: payment.amountPaisa,
        // Hidden is never deleted, so neither of these can go missing; if one ever does it says so rather than showing a blank.
        category: trade?.name ?? 'No longer on the list',
        paidToName: paidTo?.name ?? 'A one-off',
      })
    }

    // How many there are altogether, so the card can say what it is showing five of rather than implying the house has five.
    return { rows, standing: standing.length }
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
