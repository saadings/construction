import { WHY_IT_CAME } from '../../shared/validation/moneyIn'
import type { Doc } from '../_generated/dataModel'
import type { SiteQueryCtx } from '../utils/siteAccess'
import { siteQuery } from '../utils/siteAccess'

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

    return withNames.sort((one, other) => other.day.localeCompare(one.day))
  },
})

// Every figure here is the sum of the rows behind it. There is nowhere to type one, which is the whole difference from the workbooks.
export const totals = siteQuery({
  handler: async (ctx) => {
    const standing = await standingOn(ctx)

    // Started from the list of reasons rather than from the rows, so a reason nothing has come in under reads as zero instead of going missing.
    const byWhy = Object.fromEntries(WHY_IT_CAME.map((why) => [why, 0])) as Record<(typeof WHY_IT_CAME)[number], number>
    for (const receipt of standing) {
      byWhy[receipt.why] += receipt.amountPaisa
    }

    return {
      byWhy,
      // Not a fourth sum: the three above are every receipt on the site, split three ways, and this says so out loud.
      receivedPaisa: byWhy.partnerMoney + byWhy.clientPayment + byWhy.sale,
    }
  },
})
