import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Who may use the app: what Clerk knows about a sign-in, mirrored here so the ledger can answer for one without asking them.

// It says nothing about who somebody is in the books. It carried a `personId` for a while and nothing ever wrote it, so it was a link that existed only in the type -- and a field that is always absent is a promise the schema cannot keep. The day a screen wants to say "you" about a figure, it comes back with a writer and a reader in the same change.

export const accountsSchema = defineTable({
  externalId: v.string(),
  name: v.string(),
  primaryEmail: v.string(),
  otherEmails: v.array(v.string()),
  imageUrl: v.optional(v.string()),
}).index('byExternalId', ['externalId'])
