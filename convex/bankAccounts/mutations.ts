import { v } from 'convex/values'

import { bankAccountArriving } from '../../shared/validation/bankAccount'
import { authenticatedMutation } from '../utils/auth'
import { checked } from '../utils/checked'

// The whole account number never leaves the device. The screen keeps only its last four digits and sends those, so there is nothing here to store, nothing to log and nothing to leak.

// Checked again on arrival anyway, because a caller is never the authority on what it sent and four digits is cheap to insist on.
export const add = authenticatedMutation({
  args: { label: v.string(), lastFourDigits: v.string() },
  handler: async (ctx, args) => {
    const account = checked(bankAccountArriving, args)

    return await ctx.db.insert('bankAccounts', {
      label: account.label,
      lastFourDigits: account.lastFourDigits,
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
