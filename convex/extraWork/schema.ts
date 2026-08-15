import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Work outside what was contracted, billed to the client on its own. LESS EXTRA WORK in the workbooks was this, subtracted at the end because nobody had anywhere to put it.
export const extraWorkBillsSchema = defineTable({
  siteId: v.id('sites'),
  // A day, never a moment. YYYY-MM-DD.
  raisedOn: v.string(),
  description: v.string(),
  // Hidden rather than erased, because a client disagreeing about extra work is the argument this table exists to settle.
  removed: v.boolean(),
  addedByExternalId: v.string(),
  changedByExternalId: v.optional(v.string()),
  changedAt: v.optional(v.number()),
}).index('bySiteAndDay', ['siteId', 'raisedOn'])

// One line of one bill. The total is never here: it is the lines added up, on every read.
export const extraWorkBillLinesSchema = defineTable({
  billId: v.id('extraWorkBills'),
  siteId: v.id('sites'),
  position: v.number(),
  description: v.string(),
  // How the quantity was arrived at, exactly as it was worked out on paper: 39.75' x 0.375' x 11'. Kept as text beside the number because this is what makes the bill defensible to a client, and no parse of it would survive the way people actually write it.
  working: v.optional(v.string()),
  // What the working comes to, in whatever unit the rate is against.
  quantity: v.number(),
  unit: v.string(),
  ratePaisa: v.number(),
}).index('byBill', ['billId'])
