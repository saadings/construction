import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Which account a cheque or transfer left. Cash leaves none, which is why a payment points here optionally.
export const bankAccountsSchema = defineTable({
  // As it is said out loud: "Bank 0000".
  label: v.string(),
  // Only the last four digits are ever taken. Masking is what is stored, not what is drawn, because a partner may screenshot any screen.
  lastFourDigits: v.string(),
  // Hidden rather than deleted, because payments point at it forever.
  hidden: v.boolean(),
}).index('byLabel', ['label'])
