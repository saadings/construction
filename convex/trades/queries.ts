import { ledgerQuery } from '../utils/ledgerAccess'

// The trade list a day sheet picks from, in the order the workbooks put them rather than alphabetically, because that order is how the work happens.
export const list = ledgerQuery({
  handler: async (ctx) => {
    const trades = await ctx.db.query('trades').collect()

    return trades.filter((trade) => !trade.hidden).sort((one, other) => one.position - other.position)
  },
})
