import type { Doc } from '../_generated/dataModel'
import { ledgerQuery } from '../utils/ledgerAccess'
import type { SiteQueryCtx } from '../utils/siteAccess'
import { siteQuery } from '../utils/siteAccess'
import { newestFirst, splitByWhy } from './whatHasComeIn'

// Everything still standing on this site. Removed receipts are read back nowhere, but they are still there to settle an argument with.
async function standingOn(ctx: SiteQueryCtx): Promise<Array<Doc<'moneyIn'>>> {
  const all = await ctx.db
    .query('moneyIn')
    .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
    .collect()

  return all.filter((receipt) => !receipt.removed)
}

// Newest first, matching the day sheet: what came in this week is what anyone is looking for.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const standing = await standingOn(ctx)

    const withNames = []
    for (const receipt of standing) {
      const from = await ctx.db.get('people', receipt.fromId)

      withNames.push({
        ...receipt,
        // A person is hidden, never deleted, so a receipt cannot lose the name behind it; if one ever does, it says so rather than showing a blank.
        fromName: from?.name ?? 'Somebody no longer in the list',
      })
    }

    return withNames.sort(newestFirst)
  },
})

// Every figure here is the sum of the rows behind it. There is nowhere to type one, which is the whole difference from the workbooks.
export const totals = siteQuery({
  handler: async (ctx) => {
    return splitByWhy(await standingOn(ctx))
  },
})

// Every receipt in the ledger, over every house. Read whole rather than per house, because the question this screen answers is what has come in altogether -- and adding three houses up by hand is the thing this app exists to stop.

// A ledger read rather than a site one: signing in is the whole of who may look, and every screen that spans houses -- what is owed, the dashboard -- is read the same way.
export const everywhere = ledgerQuery({
  handler: async (ctx) => {
    const [all, people, sites] = await Promise.all([
      ctx.db.query('moneyIn').collect(),
      ctx.db.query('people').collect(),
      ctx.db.query('sites').collect(),
    ])

    const standing = all.filter((receipt) => !receipt.removed)
    const named = new Map(people.map((person) => [person._id, person.name]))
    const houseNamed = new Map(sites.map((site) => [site._id, site.name]))

    const receipts = standing
      .map((receipt) => ({
        _id: receipt._id,
        day: receipt.day,
        amountPaisa: receipt.amountPaisa,
        why: receipt.why,
        method: receipt.method,
        reference: receipt.reference,
        note: receipt.note,
        siteId: receipt.siteId,
        // Both names read back the same way a site's own list reads them: hidden is not deleted, so a row cannot lose what is behind it, and if one ever does it says so rather than showing a blank.
        siteName: houseNamed.get(receipt.siteId) ?? 'A house no longer in the list',
        fromName: named.get(receipt.fromId) ?? 'Somebody no longer in the list',
      }))
      .sort(newestFirst)

    return { receipts, ...splitByWhy(standing) }
  },
})
