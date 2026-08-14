import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const tradesSchema = defineTable({
  name: v.string(),
  // False only for money not spent building: buying the land, its taxes and the commission on it.
  countsAsBuildingCost: v.boolean(),
  position: v.number(),
  // Hidden rather than deleted, because payments point at it forever.
  hidden: v.boolean(),
}).index('byName', ['name'])
