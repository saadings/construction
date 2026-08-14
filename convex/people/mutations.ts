import { v } from 'convex/values'

import { personInput } from '../../shared/validation/person'
import { authenticatedMutation } from '../utils/auth'
import { checked } from '../utils/checked'

const typedIn = {
  name: v.string(),
  phone: v.optional(v.string()),
  notes: v.optional(v.string()),
}

export const add = authenticatedMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const person = checked(personInput, args)

    return await ctx.db.insert('people', { ...person, hidden: false })
  },
})

export const edit = authenticatedMutation({
  args: { personId: v.id('people'), ...typedIn },
  handler: async (ctx, args) => {
    const person = checked(personInput, args)

    await ctx.db.patch('people', args.personId, person)
  },
})

// Hidden, never deleted: payments point at a person forever, and a name that vanishes turns settled money into a mystery.
export const hide = authenticatedMutation({
  args: { personId: v.id('people') },
  handler: async (ctx, { personId }) => {
    await ctx.db.patch('people', personId, { hidden: true })
  },
})
