import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Money arriving: a partner putting his share in, a client paying against his bill, a house sold.

// It replaces 22 figures welded inside one spreadsheet formula with no dates and no detail behind them.
export const moneyInSchema = defineTable({
  siteId: v.id('sites'),
  // A day, never a moment. YYYY-MM-DD.
  day: v.string(),
  // Whole paisa. Negative means it went back out again.
  amountPaisa: v.number(),
  // Who it came from. A buyer is nobody in the ledger until the day he pays, and becomes a person then.
  fromId: v.id('people'),
  // What the money is, asked rather than worked out from the role its sender holds: on a house built for himself one man is partner and client at once.
  why: v.union(v.literal('partnerMoney'), v.literal('clientPayment'), v.literal('sale')),
  method: v.union(v.literal('cheque'), v.literal('cash'), v.literal('transfer'), v.literal('payOrder')),
  // The cheque number, as written on the cheque handed over.
  reference: v.optional(v.string()),
  // Which account it landed in. Absent for cash, which lands in none.
  bankAccountId: v.optional(v.id('bankAccounts')),
  note: v.optional(v.string()),
  // Hidden rather than erased, so a disagreement about what was received can be settled.
  removed: v.boolean(),
  addedByExternalId: v.string(),
  // Absent until someone changes or removes this. A removal nobody signed is the exact case a disagreement about money turns on.
  changedByExternalId: v.optional(v.string()),
  // Milliseconds, matching `_creationTime`. The one moment in this table: it records what a person did, not when money moved.
  changedAt: v.optional(v.number()),
})
  .index('bySiteAndDay', ['siteId', 'day'])
  // What one partner has put in, across every house. A partner's position is that figure against what he has spent, and neither half is a per-site question.
  .index('byFromAndDay', ['fromId', 'day'])
