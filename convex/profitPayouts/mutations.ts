import { ConvexError, v } from 'convex/values'

import { payoutsGoingOut } from '../../shared/validation/profitShare'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// A partner taking his share out. Kept apart from payments on purpose: a payment is what the house cost, and a share going back is not a cost.

// Allowed before the house is sold, and deliberately. Nothing is *due* until it sells, but partners take money out against a profit that has not happened yet -- the workbooks are full of it -- and a ledger that refused to record it would be a ledger that disagreed with the cheque book. What the screen must not do is call it a debt settled, and that is the screen's problem rather than this one's.
const oneWayOut = v.object({
  personId: v.id('people'),
  day: v.string(),
  amount: v.union(v.string(), v.number()),
  method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
  reference: v.optional(v.string()),
  bankAccountId: v.optional(v.id('bankAccounts')),
  note: v.optional(v.string()),
})

// A list, because a partner can be paid part by cheque and part in cash. All of them or none: two calls would leave a refused half out and the other half in, and a payout that went out as 300,000 sitting in the ledger as 200,000 is indistinguishable from one that really was 200,000.
export const record = siteMutation({
  args: { payouts: v.array(oneWayOut) },
  handler: async (ctx, args) => {
    const payouts = checked(payoutsGoingOut, args.payouts)

    const written = []
    for (const payout of payouts) {
      written.push(
        await ctx.db.insert('profitPayouts', {
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
      )
    }

    return written
  },
})

// Taken out of the ledger, never erased, and signed. A removal nobody signed is the exact case a disagreement about money turns on.
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
