import { defineSchema } from 'convex/server'

import { paymentsSchema } from './payments/schema'
import { peopleSchema } from './people/schema'
import { siteRolesSchema } from './siteRoles/schema'
import { sitesSchema } from './sites/schema'
import { tradesSchema } from './trades/schema'
import { usersSchema } from './users/schema'

export default defineSchema({
  payments: paymentsSchema,
  people: peopleSchema,
  siteRoles: siteRolesSchema,
  sites: sitesSchema,
  trades: tradesSchema,
  users: usersSchema,
})
