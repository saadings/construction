import { v } from 'convex/values'

import { engagementInput } from '../../shared/validation/bill'
import { checked } from '../utils/checked'
import { siteMutation } from '../utils/siteAccess'

// Putting a person on a trade at a site with what was agreed. Agreed only: what is billed and what is paid arrive separately and will differ from it and from each other.
export const agree = siteMutation({
  args: {
    personId: v.id('people'),
    tradeId: v.id('trades'),
    agreed: v.optional(v.union(v.string(), v.number())),
    rate: v.optional(v.union(v.string(), v.number())),
    unit: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const engagement = checked(engagementInput, args)

    return await ctx.db.insert('engagements', {
      siteId: ctx.siteId,
      personId: engagement.personId,
      tradeId: engagement.tradeId,
      agreedPaisa: engagement.agreed,
      ratePaisa: engagement.rate,
      unit: engagement.unit,
      note: engagement.note,
      hidden: false,
    })
  },
})
