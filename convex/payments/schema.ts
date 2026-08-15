import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// One filled amount cell in the workbooks equals one row here.
export const paymentsSchema = defineTable({
  siteId: v.id('sites'),
  tradeId: v.id('trades'),
  // A day, never a moment. YYYY-MM-DD.
  day: v.string(),
  // Whole paisa. Negative means money came back.
  amountPaisa: v.number(),
  // Absent for a one-off shop nobody will be paid again.
  paidToId: v.optional(v.id('people')),
  // Whose money it was, which is what makes a partner split add up on its own rather than being reconciled by hand.
  paidById: v.id('people'),
  method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
  // The cheque number. There are 7,109 of them across the workbooks.
  reference: v.optional(v.string()),
  // Which account the money left. Optional here because cash leaves none; a cheque or transfer without one is refused where the rule can be written.
  bankAccountId: v.optional(v.id('bankAccounts')),
  // Money goes out on account -- 50,000 to the tile fixer, not against bill seven -- so this is offered for the cases where it matters and never asked for.
  billId: v.optional(v.id('bills')),
  note: v.optional(v.string()),
  // Outside the contracted scope, which is what LESS EXTRA WORK meant.
  isExtraWork: v.boolean(),
  // Hidden rather than erased, so a disagreement about what was paid can be settled.
  removed: v.boolean(),
  addedByExternalId: v.string(),
  // Absent until someone changes or removes this. A removal nobody signed is the exact case a disagreement about money turns on.
  changedByExternalId: v.optional(v.string()),
  // Milliseconds, matching `_creationTime`. The one moment in this table: it records what a person did, not when money moved.
  changedAt: v.optional(v.number()),
})
  .index('bySiteAndDay', ['siteId', 'day'])
  .index('bySiteAndTrade', ['siteId', 'tradeId'])
  .index('byPaidTo', ['paidToId'])
  // A person's account is their bills and their payments in date order across every site, which is one read of this and one of the bills.
  .index('byPaidToAndDay', ['paidToId', 'day'])
