import type { SiteQueryCtx } from '../utils/siteAccess'
import { siteQuery } from '../utils/siteAccess'

// What has actually gone back to the partners on this house, one row at a time.

// `partners.queries.positions` already sums this into a `paidPaisa` per partner, and a sum is not enough to take one back: a removal names a single payout, and a total names none of them. So this exists to make the list of them readable, not to say anything about the totals -- the two are worked out from the same rows, and only these carry an id.
export const forSite = siteQuery({
  handler: async (ctx) => {
    const standing = await standingOn(ctx)

    const withNames = []
    for (const payout of standing) {
      const person = await ctx.db.get('people', payout.personId)

      withNames.push({
        ...payout,
        // A person is hidden, never deleted, so a payout cannot lose the name behind it; if one ever does, it says so rather than showing a blank.
        personName: person?.name ?? 'Somebody no longer in the list',
      })
    }

    // The day carries no time, and partners are often paid on the same day out of one cheque book. What separates two rows is written down rather than left to whichever order they came back in, so the list reads the same twice.

    // Newest first, then largest, then the name; the id settles the rest, because two payouts alike in day, amount and person are the same thing to anyone reading them and the last step only has to be steady.
    return withNames.sort(
      (one, other) =>
        other.day.localeCompare(one.day) ||
        other.amountPaisa - one.amountPaisa ||
        one.personName.localeCompare(other.personName) ||
        one._id.localeCompare(other._id)
    )
  },
})

// Everything still standing on this house. Removed payouts are read back nowhere, but they are still there to settle an argument with.
async function standingOn(ctx: SiteQueryCtx) {
  const all = await ctx.db
    .query('profitPayouts')
    .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
    .collect()

  return all.filter((payout) => !payout.removed)
}
