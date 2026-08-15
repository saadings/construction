import { defineSchema } from 'convex/server'

import { accountsSchema } from './accounts/schema'
import { bankAccountsSchema } from './bankAccounts/schema'
import { billsSchema } from './bills/schema'
import { contractsSchema } from './contracts/schema'
import { engagementsSchema } from './engagements/schema'
import { extraWorkBillLinesSchema, extraWorkBillsSchema } from './extraWork/schema'
import { milestonesSchema } from './milestones/schema'
import { moneyInSchema } from './moneyIn/schema'
import { paymentsSchema } from './payments/schema'
import { peopleSchema } from './people/schema'
import { siteRolesSchema } from './siteRoles/schema'
import { sitesSchema } from './sites/schema'
import { tradesSchema } from './trades/schema'

export default defineSchema({
  accounts: accountsSchema,
  bankAccounts: bankAccountsSchema,
  bills: billsSchema,
  contracts: contractsSchema,
  engagements: engagementsSchema,
  extraWorkBillLines: extraWorkBillLinesSchema,
  extraWorkBills: extraWorkBillsSchema,
  milestones: milestonesSchema,
  moneyIn: moneyInSchema,
  payments: paymentsSchema,
  people: peopleSchema,
  siteRoles: siteRolesSchema,
  sites: sitesSchema,
  trades: tradesSchema,
})
