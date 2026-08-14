import { ConvexError, v } from 'convex/values'

import { siteInput } from '../../shared/validation/site'
import { authenticatedMutation } from '../utils/auth'
import { checked } from '../utils/checked'
import { personSignedInAs, siteMutation } from '../utils/siteAccess'

const typedIn = {
  name: v.string(),
  plotNumber: v.optional(v.string()),
  block: v.optional(v.string()),
  phase: v.optional(v.string()),
  scheme: v.optional(v.string()),
  coveredAreaSqft: v.optional(v.union(v.string(), v.number())),
  startedOn: v.optional(v.string()),
  builtForAClient: v.boolean(),
  stage: v.union(
    v.literal('planning'),
    v.literal('building'),
    v.literal('finishing'),
    v.literal('complete'),
    v.literal('sold')
  ),
}

export const start = authenticatedMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const personId = await personSignedInAs(ctx, ctx.identity)
    if (personId === null) {
      throw new ConvexError('Ask Nauman to add you before you start a site.')
    }

    const details = checked(siteInput, args)
    const siteId = await ctx.db.insert('sites', { ...details, hidden: false })

    // Whoever starts a site is a partner on it. Without this the first site anyone makes would be one nobody could open.
    await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })

    return siteId
  },
})

export const edit = siteMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const details = checked(siteInput, args)

    await ctx.db.patch('sites', ctx.siteId, details)
  },
})

// Hidden, never deleted, because every payment on it points here.
export const hide = siteMutation({
  handler: async (ctx) => {
    await ctx.db.patch('sites', ctx.siteId, { hidden: true })
  },
})
