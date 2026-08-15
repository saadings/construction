import { partnerQuery } from '../utils/partnerAccess'

// The accounts a cheque or transfer can have left, in the order they are spoken about.
export const list = partnerQuery({
  handler: async (ctx) => {
    const accounts = await ctx.db.query('bankAccounts').withIndex('byLabel').collect()

    return accounts.filter((account) => !account.hidden)
  },
})
