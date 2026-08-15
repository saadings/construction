import { v } from 'convex/values'

import { personInput } from '../../shared/validation/person'
import { checked } from '../utils/checked'
import { partnerMutation } from '../utils/partnerAccess'

const typedIn = {
  name: v.string(),
  phone: v.optional(v.string()),
  notes: v.optional(v.string()),
}

export const add = partnerMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const person = checked(personInput, args)

    return await ctx.db.insert('people', { ...person, hidden: false })
  },
})

export const edit = partnerMutation({
  args: { personId: v.id('people'), ...typedIn },
  handler: async (ctx, args) => {
    const person = checked(personInput, args)

    await ctx.db.patch('people', args.personId, person)
  },
})

// Hidden, never deleted: payments point at a person forever, and a name that vanishes turns settled money into a mystery.
export const hide = partnerMutation({
  args: { personId: v.id('people') },
  handler: async (ctx, { personId }) => {
    await ctx.db.patch('people', personId, { hidden: true })
  },
})
