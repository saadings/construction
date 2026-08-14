import { defineSchema } from 'convex/server'

import { usersSchema } from './users/schema'

export default defineSchema({
  users: usersSchema,
})
