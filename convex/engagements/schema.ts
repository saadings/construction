import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// A person put on a trade at a site, with what was agreed. This is the workbooks' vendor sub-header rows becoming real data.

// It records what was **agreed** and nothing else. What was billed and what was paid are separate, and their differing is the whole point of the 199-M variance sheet.
export const engagementsSchema = defineTable({
  siteId: v.id('sites'),
  personId: v.id('people'),
  tradeId: v.id('trades'),
  // A lump sum: Akram, civil labour, 300,000.
  agreedPaisa: v.optional(v.number()),
  // Or a rate against a unit, for work that is measured rather than contracted whole: 55 a square foot, 4,500 a load.
  ratePaisa: v.optional(v.number()),
  unit: v.optional(v.string()),
  note: v.optional(v.string()),
  hidden: v.boolean(),
})
  .index('bySiteAndPerson', ['siteId', 'personId'])
  .index('byPerson', ['personId'])
  .index('bySite', ['siteId'])
