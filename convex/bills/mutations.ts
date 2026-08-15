import { ConvexError, v } from 'convex/values'

import { billInput } from '../../shared/validation/bill'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// What someone is owed, raised against a site. Nothing about this is asked of a payment: money goes out on account, and most of it never has a bill at all.
export const raise = siteMutation({
  args: {
    personId: v.id('people'),
    tradeId: v.id('trades'),
    day: v.string(),
    amount: v.union(v.string(), v.number()),
    reference: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bill = checked(billInput, args)

    return await ctx.db.insert('bills', {
      siteId: ctx.siteId,
      personId: bill.personId,
      tradeId: bill.tradeId,
      day: bill.day,
      amountPaisa: bill.amount,
      reference: bill.reference,
      description: bill.description,
      removed: false,
      addedByExternalId: ctx.identity.subject,
    })
  },
})

// Taken out of what is owed, never erased, and signed. The same rule as a payment, for the same reason: a figure that vanishes unsigned is a disagreement nobody can settle.
export const remove = siteMutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get('bills', args.billId)

    if (bill === null || bill.siteId !== ctx.siteId) {
      throw new ConvexError('That bill is not on this site.')
    }

    await ctx.db.patch('bills', args.billId, {
      removed: true,
      changedByExternalId: ctx.identity.subject,
      // The server's clock, not the caller's.
      changedAt: Date.now(),
    })
  },
})
