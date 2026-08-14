import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// The subset of people who sign in. An account belongs to a person; a person knows nothing about signing in.
export const accountsSchema = defineTable({
  externalId: v.string(),
  name: v.string(),
  primaryEmail: v.string(),
  otherEmails: v.array(v.string()),
  imageUrl: v.optional(v.string()),
  // Which person is signing in. Optional because signing in proves who someone is, not that anyone has said what they may reach.
  personId: v.optional(v.id('people')),
}).index('byExternalId', ['externalId'])
