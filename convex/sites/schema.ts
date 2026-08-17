import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const sitesSchema = defineTable({
  // As it is spoken about: "1-A, Phase 0".
  name: v.string(),
  plotNumber: v.optional(v.string()),
  block: v.optional(v.string()),
  phase: v.optional(v.string()),
  scheme: v.optional(v.string()),
  coveredAreaSqft: v.optional(v.number()),
  // What the build is expected to cost, in whole paisa. Absent until somebody says: a house with no estimate is not a house estimated at nothing, and every screen that measures spending against this has to be able to tell those apart.
  budgetEstimatePaisa: v.optional(v.number()),
  startedOn: v.optional(v.string()),
  // The only thing deciding whether a site shows a sale or a bill: false means the partners own the plot and will sell it.
  builtForAClient: v.boolean(),
  stage: v.union(
    v.literal('planning'),
    v.literal('building'),
    v.literal('finishing'),
    v.literal('complete'),
    v.literal('sold')
  ),
  hidden: v.boolean(),
}).index('byStage', ['stage'])
