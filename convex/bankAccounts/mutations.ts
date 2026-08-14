import { v } from 'convex/values'

import { bankAccountInput } from '../../shared/validation/bankAccount'
import { authenticatedMutation } from '../utils/auth'
import { checked } from '../utils/checked'

// The full number is typed here and never leaves this function. Only the last four digits are written down, so there is nothing to leak from a screenshot later.
export const add = authenticatedMutation({
  args: { label: v.string(), number: v.string() },
  handler: async (ctx, args) => {
    const account = checked(bankAccountInput, args)

    return await ctx.db.insert('bankAccounts', {
      label: account.label,
      lastFourDigits: account.number,
      hidden: false,
    })
  },
})

export const hide = authenticatedMutation({
  args: { bankAccountId: v.id('bankAccounts') },
  handler: async (ctx, { bankAccountId }) => {
    await ctx.db.patch('bankAccounts', bankAccountId, { hidden: true })
  },
})
