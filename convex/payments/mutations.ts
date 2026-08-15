import { ConvexError, v } from 'convex/values'

import { SAY, daySheet } from '../../shared/validation/payment'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

const anEntry = v.object({
  tradeId: v.id('trades'),
  day: v.string(),
  amount: v.union(v.string(), v.number()),
  paidToId: v.optional(v.id('people')),
  newPerson: v.optional(v.string()),
  method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
  reference: v.optional(v.string()),
  bankAccountId: v.optional(v.id('bankAccounts')),
  note: v.optional(v.string()),
  isExtraWork: v.optional(v.boolean()),
})

// A sitting, not a form submitted eight times: one cheque run on a Tuesday touching eight trades is one write.

// All of them land or none do, so there is no half-saved day left to reconcile afterwards.
export const record = siteMutation({
  args: { entries: v.array(anEntry) },
  handler: async (ctx, args) => {
    const entries = checked(daySheet, args.entries)

    const written = []
    for (const entry of entries) {
      // A name typed once for a shop nobody will pay again still becomes a person, because the payment has to point at somebody.
      let paidToId = entry.paidToId
      if (paidToId === undefined) {
        // The schema has already refused an entry paid to nobody. This is how the type sees that, and it says the same sentence, so one mistake can never come back worded two ways.
        if (entry.newPerson === undefined) {
          throw new ConvexError(SAY.paidTo)
        }
        paidToId = await ctx.db.insert('people', { name: entry.newPerson, hidden: false })
      }

      written.push(
        await ctx.db.insert('payments', {
          siteId: ctx.siteId,
          tradeId: entry.tradeId,
          day: entry.day,
          amountPaisa: entry.amount,
          paidToId,
          method: entry.method,
          reference: entry.reference,
          bankAccountId: entry.bankAccountId,
          note: entry.note,
          isExtraWork: entry.isExtraWork,
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
  args: { paymentId: v.id('payments') },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get('payments', args.paymentId)

    // Checked against the site the caller was let into, so naming another site's payment reaches nothing.
    if (payment === null || payment.siteId !== ctx.siteId) {
      throw new ConvexError('That payment is not on this site.')
    }

    await ctx.db.patch('payments', args.paymentId, {
      removed: true,
      changedByExternalId: ctx.identity.subject,
      // The server's clock, not the caller's: a phone with the wrong date must not be able to say when a payment was taken out.
      changedAt: Date.now(),
    })
  },
})
