import { defineSchema } from 'convex/server'

import { organizationMembersSchema } from './organizationMembers/schema'
import { organizationsSchema } from './organizations/schema'
import { usersSchema } from './users/schema'

export default defineSchema({
  organizationMembers: organizationMembersSchema,
  organizations: organizationsSchema,
  users: usersSchema,
})
