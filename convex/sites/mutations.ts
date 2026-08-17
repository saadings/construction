import { v } from 'convex/values'

import { siteInput } from '../../shared/validation/site'
import { checked } from '../utils/checked'
import { ledgerMutation } from '../utils/ledgerAccess'
import { siteMutation } from '../utils/siteAccess'

const typedIn = {
  name: v.string(),
  plotNumber: v.optional(v.string()),
  block: v.optional(v.string()),
  phase: v.optional(v.string()),
  scheme: v.optional(v.string()),
  coveredAreaSqft: v.optional(v.union(v.string(), v.number())),
  budgetEstimatePaisa: v.optional(v.union(v.string(), v.number())),
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

// Anyone signed in starts a house, and everyone signed in can then open it. Who is a partner, an investor or a client on it is written down separately, because that is about the money rather than about who may look.
export const start = ledgerMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const details = checked(siteInput, args)

    return await ctx.db.insert('sites', { ...details, hidden: false })
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
