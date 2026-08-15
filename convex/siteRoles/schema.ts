import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Who somebody is on a house, for the money rather than for the door: everyone signed in reaches every house. It is what a profit share and a client's account are worked out from.
export const siteRolesSchema = defineTable({
  personId: v.id('people'),
  siteId: v.id('sites'),
  // Supplying is not a capacity — that is an engagement, plus bills and payments against the person.
  capacity: v.union(v.literal('partner'), v.literal('investor'), v.literal('client')),
})
  .index('byPerson', ['personId'])
  .index('bySite', ['siteId'])
  .index('bySiteAndPerson', ['siteId', 'personId'])
