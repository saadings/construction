import { ConvexError, v } from 'convex/values'

import { SAY_SHARE, saySharesDoNotAddUp, sharesAgreed, shortOfTheWhole } from '../../shared/validation/profitShare'
import { whoIsMeant } from '../people/theSamePerson'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// Agreed as a set, and replaced as a set. Shares are parts of one whole, so setting them one at a time would leave the house holding a whole that does not add up until somebody remembers to finish.
export const agree = siteMutation({
  args: {
    agreedOn: v.string(),
    shares: v.array(
      v.object({
        // Picked, or typed: somebody may take a share of a house without ever having put money into it, and then the ledger has never met him.
        personId: v.optional(v.id('people')),
        newPerson: v.optional(v.string()),
        share: v.union(v.string(), v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const agreed = checked(sharesAgreed, args)

    const short = shortOfTheWhole(agreed.shares)
    if (short !== 0) {
      const site = await ctx.db.get('sites', ctx.siteId)

      throw new ConvexError(saySharesDoNotAddUp(site?.name ?? 'this house', short))
    }

    // Resolved before they are counted, and that order is the point: two rows typing one name are one man, and asked before this they look like two. The whole mutation is one transaction, so a name written here and then refused below is rolled back with everything else.
    const taking = []
    for (const one of agreed.shares) {
      taking.push({ personId: await whoIsMeant(ctx, one, SAY_SHARE.who), share: one.share })
    }

    // Two rows for one person would be a share counted twice, and it is the shape a half-finished edit leaves behind.
    const named = new Set(taking.map((one) => one.personId))
    if (named.size !== taking.length) {
      throw new ConvexError('Somebody is down twice. Put each person in once.')
    }

    const already = await ctx.db
      .query('profitShares')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    for (const one of already) {
      await ctx.db.delete('profitShares', one._id)
    }

    for (const one of taking) {
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
