import { ConvexError, v } from 'convex/values'

import { SAY_IN, moneyArriving } from '../../shared/validation/moneyIn'
import { whoIsMeant } from '../people/theSamePerson'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// One arrival of money, written where the site is already known to be the caller's.
const anArrival = v.object({
  day: v.string(),
  amount: v.union(v.string(), v.number()),
  fromId: v.optional(v.id('people')),
  newPerson: v.optional(v.string()),
  why: v.union(v.literal('partnerMoney'), v.literal('clientPayment'), v.literal('sale')),
  method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
  reference: v.optional(v.string()),
  bankAccountId: v.optional(v.id('bankAccounts')),
  note: v.optional(v.string()),
})

// A list, because money arrives one way or two: 200,000 by cheque and 100,000 in cash is one arrival settled twice, and it is two rows sharing a day, a person and a reason.

// All of them or none. Sent as two calls, a refused half would leave the other in the ledger with nothing on the screen saying which of the two went in.
export const record = siteMutation({
  args: { arrivals: v.array(anArrival) },
  handler: async (ctx, args) => {
    const receipts = checked(moneyArriving, args.arrivals)

    const written = []
    for (const receipt of receipts) {
      // A buyer named at the sale still becomes a person, because the money has to have come from somebody. It mattered more here than anywhere: money in as `partnerMoney` is capital, and capital is what the whole profit split is worked out from, so a partner split across two rows had his share worked out from half his money.
      const fromId = await whoIsMeant(ctx, { personId: receipt.fromId, newPerson: receipt.newPerson }, SAY_IN.from)

      written.push(
        await ctx.db.insert('moneyIn', {
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
      )
    }

    return written
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
