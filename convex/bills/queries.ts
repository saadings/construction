import { siteQuery } from '../utils/siteAccess'

// What people say they are owed on this house, in the words somebody reads them in. A bill is not a payment: it is what has been claimed, and money goes out against it or without it.

// Read here by house because that is where one is raised and where a wrong one is found. A person's own account reads the same rows across every house, which is a different question and a different query.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const all = await ctx.db
      .query('bills')
      .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const standing = all.filter((bill) => !bill.removed)

    const rows = []
    for (const bill of standing) {
      const [person, trade] = await Promise.all([
        ctx.db.get('people', bill.personId),
        ctx.db.get('trades', bill.tradeId),
      ])

      rows.push({
        _id: bill._id,
        day: bill.day,
        amountPaisa: bill.amountPaisa,
        personName: person?.name ?? 'Someone no longer listed',
        tradeName: trade?.name ?? 'A trade no longer listed',
        reference: bill.reference,
        description: bill.description,
      })
    }

    // Newest first, and steady: several bills can land on one day, so what separates them is written down rather than left to whichever order the rows came back in.
    return rows.sort(
      (one, other) =>
        other.day.localeCompare(one.day) || other.amountPaisa - one.amountPaisa || one._id.localeCompare(other._id)
    )
  },
})
