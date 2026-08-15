import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// What a client agreed to pay for a house. One per site, and the thing every milestone and extra-work bill is measured against.
export const contractsSchema = defineTable({
  siteId: v.id('sites'),
  // Who agreed it. The same person row their payments and balance hang off, because one person has one account across every site.
  clientId: v.id('people'),
  agreedOn: v.string(),
  // A lump sum or a rate against area, and there is nowhere to put the other one: a rate contract has no total to go stale when the area is measured again.
  priced: v.union(
    v.object({ how: v.literal('lumpSum'), totalPaisa: v.number() }),
    v.object({ how: v.literal('ratePerSqft'), ratePerSqftPaisa: v.number() })
  ),
  // What was agreed at signing. Never overwritten, because it is what the argument is about when the measurement disagrees.
  agreedAreaSqft: v.number(),
  // What it measured. Absent until someone measures, and separate from the agreed one so a re-measurement is a calculation rather than a rewritten row.
  actualAreaSqft: v.optional(v.number()),
  note: v.optional(v.string()),
  // Hidden rather than deleted, because milestones and bills point at it forever.
  hidden: v.boolean(),
}).index('bySite', ['siteId'])
