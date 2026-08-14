import { siteQuery } from '../utils/siteAccess'

// What a site's own screen opens with. Nothing comes back when the site is not one of yours, so "not yours" and "not there" read the same from outside.
export const one = siteQuery({
  handler: async (ctx) => {
    return await ctx.db.get('sites', ctx.siteId)
  },
})
