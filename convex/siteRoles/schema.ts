import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// The whole access model: a person may reach a site if and only if they hold a row here for it.
export const siteRolesSchema = defineTable({
  personId: v.id('people'),
  siteId: v.id('sites'),
  // Supplying is not a capacity — that is an engagement, plus bills and payments against the person.
  capacity: v.union(v.literal('partner'), v.literal('investor'), v.literal('client')),
})
  .index('byPerson', ['personId'])
  .index('bySite', ['siteId'])
  .index('bySiteAndPerson', ['siteId', 'personId'])
