import { ledgerQuery } from '../utils/ledgerAccess'
import { siteQuery } from '../utils/siteAccess'

// The home screen. Every house in the ledger: one partnership keeping one set of books, so there is no such thing as somebody else's house here.

// A card a house rather than a row: what it is, who it is for, how big it is, what has gone out and what has come in. So the reading carries what a card says rather than what a row said, and the two figures are worked out from the rows behind them here -- a site with a few thousand payments is one index read either way.
export const all = ledgerQuery({
  handler: async (ctx) => {
    const open = (await ctx.db.query('sites').collect()).filter((site) => !site.hidden)

    const withSpending = []
    for (const site of open) {
      const [payments, received, roles] = await Promise.all([
        ctx.db
          .query('payments')
          .withIndex('bySiteAndDay', (q) => q.eq('siteId', site._id))
          .collect(),
        ctx.db
          .query('moneyIn')
          .withIndex('bySiteAndDay', (q) => q.eq('siteId', site._id))
          .collect(),
        ctx.db
          .query('siteRoles')
          .withIndex('bySite', (q) => q.eq('siteId', site._id))
          .collect(),
      ])

      // Derived rather than stored, the same way a funder is: `people` says deliberately nothing about roles, and a house being built for somebody is a capacity on that house rather than a field on the person.
      const client = roles.find((role) => role.capacity === 'client')
      const named = client === undefined ? null : await ctx.db.get('people', client.personId)

      withSpending.push({
        ...site,
        spentPaisa: payments.reduce((total, payment) => (payment.removed ? total : total + payment.amountPaisa), 0),
        receivedPaisa: received.reduce((total, one) => (one.removed ? total : total + one.amountPaisa), 0),
        // Absent rather than a blank: a house with nobody named on it says nothing about who it is for, and a card built from an empty string cannot tell that apart from a house whose client has no name.
        clientName: named?.name,
      })
    }

    // Newest first: the house being worked on today is the one he opens.
    return withSpending.sort((one, other) => other._creationTime - one._creationTime)
  },
})

// What a site's own screen opens with. Nothing comes back for a house that is not there.

// The client comes with it, derived from this house's own roles rather than stored on the person -- the same derivation the list uses, so the name under a house on one screen is the name under it on the other.
export const one = siteQuery({
  handler: async (ctx) => {
    const site = await ctx.db.get('sites', ctx.siteId)

    if (site === null) {
      return null
    }

    const roles = await ctx.db
      .query('siteRoles')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const client = roles.find((role) => role.capacity === 'client')
    const named = client === undefined ? null : await ctx.db.get('people', client.personId)

    return { ...site, clientName: named?.name }
  },
})
