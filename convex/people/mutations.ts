import { ConvexError, v } from 'convex/values'

import { personInput, sayTheNameIsTaken } from '../../shared/validation/person'
import { checked } from '../utils/checked'
import { ledgerMutation } from '../utils/ledgerAccess'
import { personAlreadyCalled } from './theSamePerson'

const typedIn = {
  name: v.string(),
  phone: v.optional(v.string()),
  notes: v.optional(v.string()),
}

export const add = ledgerMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const person = checked(personInput, args)
    const already = await personAlreadyCalled(ctx, person.name)

    if (already === null) {
      return await ctx.db.insert('people', { ...person, hidden: false })
    }

    // Taken off the list is not gone: refusing here would leave the name held by somebody he cannot see, with nowhere to go. Adding him again is what he means, so he comes back -- as the same row, so every payment already pointing at him still does.
    if (already.hidden) {
      await ctx.db.patch('people', already._id, { ...person, hidden: false })

      return already._id
    }

    throw new ConvexError(sayTheNameIsTaken(already.name))
  },
})

export const edit = ledgerMutation({
  args: { personId: v.id('people'), ...typedIn },
  handler: async (ctx, args) => {
    const person = checked(personInput, args)
    const already = await personAlreadyCalled(ctx, person.name)

    // The same defect through the other door: without this, two rows for one man are one edit away. Renaming somebody to what they are already called is not that.
    if (already !== null && already._id !== args.personId) {
      throw new ConvexError(sayTheNameIsTaken(already.name))
    }

    await ctx.db.patch('people', args.personId, person)
  },
})

// Hidden, never deleted: payments point at a person forever, and a name that vanishes turns settled money into a mystery.
export const hide = ledgerMutation({
  args: { personId: v.id('people') },
  handler: async (ctx, { personId }) => {
    await ctx.db.patch('people', personId, { hidden: true })
  },
})
