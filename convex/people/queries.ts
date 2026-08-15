import { ledgerQuery } from '../utils/ledgerAccess'

// Everyone, in the order a person would look for them. Hidden ones are gone from every list but still named on the payments that point at them.
export const list = ledgerQuery({
  handler: async (ctx) => {
    const everyone = await ctx.db.query('people').withIndex('byName').collect()

    return everyone.filter((person) => !person.hidden)
  },
})
