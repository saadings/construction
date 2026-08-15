import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// What a person is owed. The half the workbooks never held, without which a subcontractor's outstanding can only be guessed at as agreed-minus-paid.

// That guess works for Akram on a lump sum and fails completely for a steel supplier delivering load after load with no fixed contract.
export const billsSchema = defineTable({
  siteId: v.id('sites'),
  personId: v.id('people'),
  tradeId: v.id('trades'),
  // A day, never a moment. YYYY-MM-DD.
  day: v.string(),
  amountPaisa: v.number(),
  // Their own number on the bill or the challan, kept as written because that is what he will be asked for.
  reference: v.optional(v.string()),
  description: v.optional(v.string()),
  // Hidden rather than erased, so a disagreement about what was owed can be settled.
  removed: v.boolean(),
  addedByExternalId: v.string(),
  changedByExternalId: v.optional(v.string()),
  changedAt: v.optional(v.number()),
})
  .index('bySiteAndDay', ['siteId', 'day'])
  // A person's account spans every site, because a steel supplier delivering to two of them has one balance and not two.
  .index('byPersonAndDay', ['personId', 'day'])
