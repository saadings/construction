import { v } from 'convex/values'

import { SAY_ENGAGEMENT, engagementInput } from '../../shared/validation/bill'
import { whoIsMeant } from '../people/theSamePerson'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// Putting a person on a trade at a site with what was agreed. Agreed only: what is billed and what is paid arrive separately and will differ from it and from each other.
export const agree = siteMutation({
  args: {
    // Either: somebody picked from the list, or a name typed into it on the way past.
    personId: v.optional(v.id('people')),
    newPerson: v.optional(v.string()),
    tradeId: v.id('trades'),
    agreed: v.optional(v.union(v.string(), v.number())),
    rate: v.optional(v.union(v.string(), v.number())),
    unit: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const engagement = checked(engagementInput, args)

    // Through the one place that knows what makes two names the same man, like every other door that can name somebody.
    const personId = await whoIsMeant(ctx, engagement, SAY_ENGAGEMENT.who)

    return await ctx.db.insert('engagements', {
      siteId: ctx.siteId,
      personId,
      tradeId: engagement.tradeId,
      agreedPaisa: engagement.agreed,
      ratePaisa: engagement.rate,
      unit: engagement.unit,
      note: engagement.note,
      hidden: false,
    })
  },
})
