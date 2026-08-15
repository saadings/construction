import { billTotalPaisa, lineAmountPaisa } from '../../shared/validation/extraWork'
import { siteQuery } from '../utils/siteAccess'

// Every bill of extra work on this house, each with its lines and what they come to. No total is stored anywhere: a figure written down is the one that stays behind when a line is corrected.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const bills = await ctx.db
      .query('extraWorkBills')
      .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const standing = bills.filter((bill) => !bill.removed)

    const withLines = []
    for (const bill of standing) {
      const lines = (
        await ctx.db
          .query('extraWorkBillLines')
          .withIndex('byBill', (q) => q.eq('billId', bill._id))
          .collect()
      ).sort((one, other) => one.position - other.position)

      withLines.push({
        ...bill,
        lines: lines.map((line) => ({ ...line, amountPaisa: lineAmountPaisa(line) })),
        totalPaisa: billTotalPaisa(lines),
      })
    }

    // Newest first, and by position within a day, so two bills raised on one day read in the order they were entered.
    return withLines.sort(
      (one, other) => other.raisedOn.localeCompare(one.raisedOn) || other._creationTime - one._creationTime
    )
  },
})
