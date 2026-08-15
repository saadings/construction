import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// What each partner agreed to take of the profit on one house. It is written down only when it differs from what they put in, because a share that can only be worked out from the money is not what was asked for: who funded a house and who agreed to take the profit are not always the same people.

// Absent for a house means proportional to capital, which is the default and only the default.
export const profitSharesSchema = defineTable({
  siteId: v.id('sites'),
  personId: v.id('people'),
  // Basis points of the whole: 33.33% is 3333, and three of them come to 9999 with one left over that goes somewhere named rather than nowhere. A percentage as a float is how a third of a rupee stops being a third of a rupee.
  basisPoints: v.number(),
  agreedOn: v.string(),
  addedByExternalId: v.string(),
})
  .index('bySite', ['siteId'])
  .index('bySiteAndPerson', ['siteId', 'personId'])
