import { defineSchema } from 'convex/server'

import { accountsSchema } from './accounts/schema'
import { bankAccountsSchema } from './bankAccounts/schema'
import { paymentsSchema } from './payments/schema'
import { peopleSchema } from './people/schema'
import { siteRolesSchema } from './siteRoles/schema'
import { sitesSchema } from './sites/schema'
import { tradesSchema } from './trades/schema'

export default defineSchema({
  accounts: accountsSchema,
  bankAccounts: bankAccountsSchema,
  payments: paymentsSchema,
  people: peopleSchema,
  siteRoles: siteRolesSchema,
  sites: sitesSchema,
  trades: tradesSchema,
})
