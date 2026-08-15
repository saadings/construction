import { ConvexError, v } from 'convex/values'

import { SAY_IN, receiptInput } from '../../shared/validation/moneyIn'
import { personAlreadyCalled } from '../people/theSamePerson'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// One arrival of money, written where the site is already known to be the caller's.
export const record = siteMutation({
  args: {
    day: v.string(),
    amount: v.union(v.string(), v.number()),
    fromId: v.optional(v.id('people')),
    newPerson: v.optional(v.string()),
    why: v.union(v.literal('partnerMoney'), v.literal('clientPayment'), v.literal('sale')),
    method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
    reference: v.optional(v.string()),
    bankAccountId: v.optional(v.id('bankAccounts')),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const receipt = checked(receiptInput, args)

    // A buyer named at the sale still becomes a person, because the money has to have come from somebody.
    let fromId = receipt.fromId
    if (fromId === undefined) {
      // The schema has already refused a receipt from nobody. This is how the type sees that, and it says the same sentence, so one mistake can never come back worded two ways.
      if (receipt.newPerson === undefined) {
        throw new ConvexError(SAY_IN.from)
      }

      // A partner typed rather than picked is that partner. This mattered more here than anywhere: money coming in as `partnerMoney` is capital, and capital is what the whole profit split is worked out from, so a partner split across two rows had his share worked out from half his money.
      const already = await personAlreadyCalled(ctx, receipt.newPerson)

      // Left hidden if he is hidden: taking somebody off the list is a decision about the list, not about who the money came from.
      fromId = already?._id ?? (await ctx.db.insert('people', { name: receipt.newPerson, hidden: false }))
    }

    return await ctx.db.insert('moneyIn', {
      siteId: ctx.siteId,
      day: receipt.day,
      amountPaisa: receipt.amount,
      fromId,
      why: receipt.why,
      method: receipt.method,
      reference: receipt.reference,
      bankAccountId: receipt.bankAccountId,
      note: receipt.note,
      removed: false,
      addedByExternalId: ctx.identity.subject,
    })
  },
})

// Taken out of the ledger, never erased, and signed. A removal nobody signed is the exact case a disagreement about money turns on.
export const remove = siteMutation({
  args: { moneyInId: v.id('moneyIn') },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get('moneyIn', args.moneyInId)

    // Checked against the site the caller was let into, so naming another site's receipt reaches nothing.
    if (receipt === null || receipt.siteId !== ctx.siteId) {
      throw new ConvexError('That money is not on this site.')
    }

    await ctx.db.patch('moneyIn', args.moneyInId, {
      removed: true,
      changedByExternalId: ctx.identity.subject,
      // The server's clock, not the caller's: a phone with the wrong date must not be able to say when a receipt was taken out.
      changedAt: Date.now(),
    })
  },
})
