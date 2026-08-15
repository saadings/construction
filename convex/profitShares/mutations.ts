import { ConvexError, v } from 'convex/values'

import { saySharesDoNotAddUp, sharesAgreed, shortOfTheWhole } from '../../shared/validation/profitShare'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// Agreed as a set, and replaced as a set. Shares are parts of one whole, so setting them one at a time would leave the house holding a whole that does not add up until somebody remembers to finish.
export const agree = siteMutation({
  args: {
    agreedOn: v.string(),
    shares: v.array(v.object({ personId: v.id('people'), share: v.union(v.string(), v.number()) })),
  },
  handler: async (ctx, args) => {
    const agreed = checked(sharesAgreed, args)

    const short = shortOfTheWhole(agreed.shares)
    if (short !== 0) {
      const site = await ctx.db.get('sites', ctx.siteId)

      throw new ConvexError(saySharesDoNotAddUp(site?.name ?? 'this house', short))
    }

    // Two rows for one person would be a share counted twice, and it is the shape a half-finished edit leaves behind.
    const named = new Set(agreed.shares.map((one) => one.personId))
    if (named.size !== agreed.shares.length) {
      throw new ConvexError('Somebody is down twice. Put each person in once.')
    }

    const already = await ctx.db
      .query('profitShares')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    for (const one of already) {
      await ctx.db.delete('profitShares', one._id)
    }

    for (const one of agreed.shares) {
      await ctx.db.insert('profitShares', {
        siteId: ctx.siteId,
        personId: one.personId,
        basisPoints: one.share,
        agreedOn: agreed.agreedOn,
        addedByExternalId: ctx.identity.subject,
      })
    }

    return agreed.shares.length
  },
})

// Back to being worked out from what each of them put in, which is what a house starts on.
export const followTheMoney = siteMutation({
  handler: async (ctx) => {
    const already = await ctx.db
      .query('profitShares')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    for (const one of already) {
      await ctx.db.delete('profitShares', one._id)
    }
  },
})
