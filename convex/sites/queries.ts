import { ledgerQuery } from '../utils/ledgerAccess'
import { siteQuery } from '../utils/siteAccess'

// The home screen. Every house in the ledger: one partnership keeping one set of books, so there is no such thing as somebody else's house here.
export const all = ledgerQuery({
  handler: async (ctx) => {
    const open = (await ctx.db.query('sites').collect()).filter((site) => !site.hidden)

    // One number a row, worked out here from the rows behind it. A site with a few thousand payments is one index read.
    const withSpending = []
    for (const site of open) {
      const payments = await ctx.db
        .query('payments')
        .withIndex('bySiteAndDay', (q) => q.eq('siteId', site._id))
        .collect()

      withSpending.push({
        ...site,
        spentPaisa: payments.reduce((total, payment) => (payment.removed ? total : total + payment.amountPaisa), 0),
      })
    }

    // Newest first: the house being worked on today is the one he opens.
    return withSpending.sort((one, other) => other._creationTime - one._creationTime)
  },
})

// What a site's own screen opens with. Nothing comes back for a house that is not there.
export const one = siteQuery({
  handler: async (ctx) => {
    return await ctx.db.get('sites', ctx.siteId)
  },
})
