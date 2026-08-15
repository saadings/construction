import { ConvexError, v } from 'convex/values'

import { extraWorkBillInput, extraWorkLineInput } from '../../shared/validation/extraWork'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

const aLine = v.object({
  description: v.string(),
  working: v.optional(v.string()),
  quantity: v.union(v.string(), v.number()),
  unit: v.string(),
  ratePaisa: v.union(v.string(), v.number()),
})

// A bill and its lines land together or not at all, because a bill with no lines is a figure with nothing behind it, which is the thing this replaces.
export const raise = siteMutation({
  args: { raisedOn: v.string(), description: v.string(), lines: v.array(aLine) },
  handler: async (ctx, args) => {
    const bill = checked(extraWorkBillInput, args)

    if (args.lines.length === 0) {
      throw new ConvexError('Put in at least one line of what was done.')
    }

    const lines = args.lines.map((line) => checked(extraWorkLineInput, line))

    const billId = await ctx.db.insert('extraWorkBills', {
      ...bill,
      siteId: ctx.siteId,
      removed: false,
      addedByExternalId: ctx.identity.subject,
    })

    let position = 0
    for (const line of lines) {
      position += 1
      await ctx.db.insert('extraWorkBillLines', { ...line, billId, siteId: ctx.siteId, position })
    }

    return billId
  },
})

export const takeBack = siteMutation({
  args: { billId: v.id('extraWorkBills') },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get('extraWorkBills', args.billId)
    if (bill === null || bill.siteId !== ctx.siteId) {
      throw new ConvexError('That bill is not on this house.')
    }

    // Taken back out, never erased: a client disagreeing about extra work is what this table is for.
    await ctx.db.patch('extraWorkBills', args.billId, {
      removed: true,
      changedByExternalId: ctx.identity.subject,
      changedAt: Date.now(),
    })
  },
})
