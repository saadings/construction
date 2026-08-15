import { ConvexError, v } from 'convex/values'

import { contractInput } from '../../shared/validation/contract'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

const priced = v.union(
  v.object({ how: v.literal('lumpSum'), totalPaisa: v.union(v.string(), v.number()) }),
  v.object({ how: v.literal('ratePerSqft'), ratePerSqftPaisa: v.union(v.string(), v.number()) })
)

const typedIn = {
  clientId: v.id('people'),
  agreedOn: v.string(),
  priced,
  agreedAreaSqft: v.union(v.string(), v.number()),
  actualAreaSqft: v.optional(v.union(v.string(), v.number())),
  note: v.optional(v.string()),
}

export const agree = siteMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const contract = checked(contractInput, args)

    // One per house. A second would leave every milestone pointing at whichever one someone happened to read.
    const already = await ctx.db
      .query('contracts')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    if (already.some((one) => !one.hidden)) {
      throw new ConvexError('This house already has a contract. Change that one rather than agreeing a second.')
    }

    return await ctx.db.insert('contracts', {
      ...contract,
      clientId: args.clientId,
      siteId: ctx.siteId,
      hidden: false,
    })
  },
})

export const measure = siteMutation({
  args: { contractId: v.id('contracts'), actualAreaSqft: v.union(v.string(), v.number()) },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get('contracts', args.contractId)
    if (contract === null || contract.siteId !== ctx.siteId) {
      throw new ConvexError('That contract is not on this house.')
    }

    // Only the measured area moves. What was agreed stays as it was, because that is what a disagreement is settled against.
    const { actualAreaSqft } = checked(contractInput.pick({ actualAreaSqft: true }), {
      actualAreaSqft: args.actualAreaSqft,
    })

    await ctx.db.patch('contracts', args.contractId, { actualAreaSqft })
  },
})
