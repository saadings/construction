import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// The stages a contract is billed in. "On completion of grey structure, 25%" is one row.
export const milestonesSchema = defineTable({
  siteId: v.id('sites'),
  contractId: v.id('contracts'),
  // Where it sits in the run of them. Two on the same day need an order a person chose rather than one the database happened to give them.
  position: v.number(),
  description: v.string(),
  // A share of the contract, and no amount beside it: the amount follows the contract, which follows the measured area.
  percent: v.number(),
  // The day this stage was billed. Absent until it is, which is what makes it a stage still to come rather than one already raised.
  billedOn: v.optional(v.string()),
  hidden: v.boolean(),
})
  .index('byContract', ['contractId'])
  .index('bySite', ['siteId'])
