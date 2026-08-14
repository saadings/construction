import type { Doc } from '../_generated/dataModel'
import { authenticatedQuery } from '../utils/auth'
import { personSignedInAs, siteQuery } from '../utils/siteAccess'

// The home screen. Only the sites this person is a partner on, which is the same rule the site itself is guarded by.
export const mine = authenticatedQuery({
  handler: async (ctx) => {
    const personId = await personSignedInAs(ctx, ctx.identity)
    if (personId === null) {
      return []
    }

    const held = await ctx.db
      .query('siteRoles')
      .withIndex('byPerson', (q) => q.eq('personId', personId))
      .collect()

    const sites = await Promise.all(
      held.filter((role) => role.capacity === 'partner').map((role) => ctx.db.get('sites', role.siteId))
    )

    // Built up rather than filtered, because `filter` leaves the missing ones in the type and every caller then has to handle a site that is not there.
    const open: Array<Doc<'sites'>> = []
    for (const site of sites) {
      if (site !== null && !site.hidden) {
        open.push(site)
      }
    }

    return open
  },
})

// What a site's own screen opens with. Nothing comes back when the site is not one of yours, so "not yours" and "not there" read the same from outside.
export const one = siteQuery({
  handler: async (ctx) => {
    return await ctx.db.get('sites', ctx.siteId)
  },
})
