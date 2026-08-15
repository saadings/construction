import { ConvexError, v } from 'convex/values'

import { payoutInput } from '../../shared/validation/profitShare'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// A partner taking his share out. Kept apart from payments on purpose: a payment is what the house cost, and a share going back is not a cost.

// not-yet: nothing is due until a house sells, so nobody can be paid out on one that has not
export const record = siteMutation({
  args: {
    personId: v.id('people'),
    day: v.string(),
    amount: v.union(v.string(), v.number()),
    method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
    reference: v.optional(v.string()),
    bankAccountId: v.optional(v.id('bankAccounts')),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payout = checked(payoutInput, args)

    return await ctx.db.insert('profitPayouts', {
      siteId: ctx.siteId,
      personId: payout.personId,
      day: payout.day,
      amountPaisa: payout.amount,
      method: payout.method,
      reference: payout.reference,
      bankAccountId: payout.bankAccountId,
      note: payout.note,
      removed: false,
      addedByExternalId: ctx.identity.subject,
    })
  },
})

// Taken out of the ledger, never erased, and signed. A removal nobody signed is the exact case a disagreement about money turns on.

// not-yet: and nothing takes a payout back, for the same reason there is nothing to take back yet
export const remove = siteMutation({
  args: { payoutId: v.id('profitPayouts') },
  handler: async (ctx, args) => {
    const payout = await ctx.db.get('profitPayouts', args.payoutId)

    // Checked against the house the caller named, so naming another house's payout reaches nothing.
    if (payout === null || payout.siteId !== ctx.siteId) {
      throw new ConvexError('That payment out is not on this house.')
    }

    await ctx.db.patch('profitPayouts', args.payoutId, {
      removed: true,
      changedByExternalId: ctx.identity.subject,
      // The server's clock, not the caller's: a phone with the wrong date must not be able to say when money was taken back out.
      changedAt: Date.now(),
    })
  },
})
