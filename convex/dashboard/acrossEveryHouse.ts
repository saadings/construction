import type { ObjectType, PropertyValidators } from 'convex/values'

import type { LedgerQueryCtx } from '../utils/ledgerAccess'
import { ledgerQuery } from '../utils/ledgerAccess'

// A dashboard asks about all the houses at once, so none of its readings carries a `siteId` and none of them can go through `siteQuery`. That is a decision about who may see the whole ledger, and it is written here rather than assumed six times.

// Today the answer is everybody the ledger knows, because that is the model the whole app runs on: `people` and `bankAccounts` are global, a supplier's balance spans every house, and a sign-in that is known sees all of it.

// The day that stops being true -- one house that is not everybody's -- it stops being true here, in one file, rather than in every reading that happens to have been written without a site.
export function acrossEveryHouse<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: LedgerQueryCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  return ledgerQuery(fn)
}
