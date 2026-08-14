import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Everyone the business deals with. Deliberately no role: one person puts money into one site and sells steel to another.
export const peopleSchema = defineTable({
  name: v.string(),
  phone: v.optional(v.string()),
  notes: v.optional(v.string()),
  // Hidden rather than deleted, because payments point at them forever.
  hidden: v.boolean(),
}).index('byName', ['name'])
