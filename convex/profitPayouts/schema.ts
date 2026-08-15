import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Profit going back to a partner. It is not a payment: a payment is what the house cost, and putting a partner's share in there would make the house look more expensive every time one of them was paid.
export const profitPayoutsSchema = defineTable({
  siteId: v.id('sites'),
  personId: v.id('people'),
  // A day, never a moment. YYYY-MM-DD.
  day: v.string(),
  // Whole paisa.
  amountPaisa: v.number(),
  method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
  reference: v.optional(v.string()),
  bankAccountId: v.optional(v.id('bankAccounts')),
  note: v.optional(v.string()),
  // Hidden rather than erased, so a disagreement about what was paid out can be settled.
  removed: v.boolean(),
  addedByExternalId: v.string(),
  changedByExternalId: v.optional(v.string()),
  // Milliseconds, matching `_creationTime`. The one moment in this table: it records what a person did, not when money moved.
  changedAt: v.optional(v.number()),
})
  .index('bySiteAndDay', ['siteId', 'day'])
  .index('byPersonAndDay', ['personId', 'day'])
