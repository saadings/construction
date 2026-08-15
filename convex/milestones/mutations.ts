import { ConvexError, v } from 'convex/values'

import { milestoneInput } from '../../shared/validation/milestone'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

const typedIn = {
  contractId: v.id('contracts'),
  description: v.string(),
  percent: v.union(v.string(), v.number()),
  billedOn: v.optional(v.string()),
}

export const add = siteMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const contract = await ctx.db.get('contracts', args.contractId)
    if (contract === null || contract.siteId !== ctx.siteId) {
      throw new ConvexError('That contract is not on this house.')
    }

    const stage = checked(milestoneInput, args)

    // Ordered after whatever is already there, so the run of them reads the way it was entered rather than the way the database returns it.
    const already = await ctx.db
      .query('milestones')
      .withIndex('byContract', (q) => q.eq('contractId', args.contractId))
      .collect()

    return await ctx.db.insert('milestones', {
      ...stage,
      siteId: ctx.siteId,
      contractId: args.contractId,
      position: already.reduce((furthest, one) => Math.max(furthest, one.position), 0) + 1,
      hidden: false,
    })
  },
})

export const bill = siteMutation({
  args: { milestoneId: v.id('milestones'), billedOn: v.string() },
  handler: async (ctx, args) => {
    const stage = await ctx.db.get('milestones', args.milestoneId)
    if (stage === null || stage.siteId !== ctx.siteId) {
      throw new ConvexError('That stage is not on this house.')
    }

    if (stage.billedOn !== undefined) {
      throw new ConvexError('That stage has already been billed.')
    }

    const { billedOn } = checked(milestoneInput.pick({ billedOn: true }), { billedOn: args.billedOn })

    await ctx.db.patch('milestones', args.milestoneId, { billedOn })
  },
})
