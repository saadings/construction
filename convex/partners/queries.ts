import type { Put, Share } from '../../shared/profitSplit'
import { proportionalTo, shareOut } from '../../shared/profitSplit'
import type { Id } from '../_generated/dataModel'
import type { SiteQueryCtx } from '../utils/siteAccess'
import { siteQuery } from '../utils/siteAccess'

// What every partner on a house has put in, what he is owed of the profit, what has gone back to him, and what is left. Nauman: "every partner will be given a profit based on their investment, which will be customisable. We should also maintain the amount due to the investor and already paid."

// Nothing here is stored. A stored position is the figure that stays behind the day another cheque goes in.
export type Position = {
  personId: Id<'people'>
  name: string
  capitalPaisa: number
  basisPoints: number
  duePaisa: number
  paidPaisa: number
  balancePaisa: number
}

// Profit is what the house brought in less what it cost. A partner's own money is funding rather than income, so it is not in it -- counting it would make a house look profitable the moment somebody funded it.
async function profitOn(
  ctx: SiteQueryCtx
): Promise<{ profitPaisa: number; broughtInPaisa: number; spentPaisa: number }> {
  const [arrived, spent] = await Promise.all([
    ctx.db
      .query('moneyIn')
      .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
      .collect(),
    ctx.db
      .query('payments')
      .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
      .collect(),
  ])

  const broughtInPaisa = arrived
    .filter((one) => !one.removed && one.why !== 'partnerMoney')
    .reduce((total, one) => total + one.amountPaisa, 0)

  const spentPaisa = spent.filter((one) => !one.removed).reduce((total, one) => total + one.amountPaisa, 0)

  return { profitPaisa: broughtInPaisa - spentPaisa, broughtInPaisa, spentPaisa }
}

async function capitalOn(ctx: SiteQueryCtx): Promise<Array<Put>> {
  const arrived = await ctx.db
    .query('moneyIn')
    .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
    .collect()

  const byPerson = new Map<Id<'people'>, number>()
  for (const one of arrived) {
    if (one.removed || one.why !== 'partnerMoney') continue

    byPerson.set(one.fromId, (byPerson.get(one.fromId) ?? 0) + one.amountPaisa)
  }

  return [...byPerson].map(([personId, paisa]) => ({ personId, paisa }))
}

// The money decides who is on this list, not a role: somebody who has put capital into a house is a partner in it whatever anybody remembered to write down. An agreed share puts them on it too, since agreeing a share is saying so out loud.
export const positions = siteQuery({
  handler: async (ctx) => {
    const capital = await capitalOn(ctx)
    const agreed = await ctx.db
      .query('profitShares')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const shares: Array<Share> =
      agreed.length > 0
        ? agreed.map((one) => ({ personId: one.personId, basisPoints: one.basisPoints }))
        : proportionalTo(capital)

    const { profitPaisa, broughtInPaisa, spentPaisa } = await profitOn(ctx)
    const due = new Map(shareOut(profitPaisa, shares).map((part) => [part.personId, part.paisa]))
    const paid = await paidOutOn(ctx)

    const everyone = new Set<string>([...capital.map((put) => put.personId), ...shares.map((share) => share.personId)])

    const positions: Array<Position> = []
    for (const personId of everyone) {
      const person = await ctx.db.get('people', personId as Id<'people'>)
      const duePaisa = due.get(personId) ?? 0
      const paidPaisa = paid.get(personId) ?? 0

      positions.push({
        personId: personId as Id<'people'>,
        // A person is hidden, never deleted, so a position cannot lose the name behind it; if one ever does, it says so rather than showing a blank.
        name: person?.name ?? 'Somebody no longer in the list',
        capitalPaisa: capital.find((put) => put.personId === personId)?.paisa ?? 0,
        basisPoints: shares.find((share) => share.personId === personId)?.basisPoints ?? 0,
        duePaisa,
        paidPaisa,
        balancePaisa: duePaisa - paidPaisa,
      })
    }

    // Most put in first, and two who put in the same read by name, so the list reads the same twice.
    positions.sort((one, other) => other.capitalPaisa - one.capitalPaisa || one.name.localeCompare(other.name))

    return {
      positions,
      broughtInPaisa,
      spentPaisa,
      profitPaisa,
      // Whether the shares were agreed or worked out from the money. A screen saying which is the difference between a figure somebody chose and one nobody has looked at.
      sharesAgreed: agreed.length > 0,
    }
  },
})

async function paidOutOn(ctx: SiteQueryCtx): Promise<Map<string, number>> {
  const payouts = await ctx.db
    .query('profitPayouts')
    .withIndex('bySiteAndDay', (q) => q.eq('siteId', ctx.siteId))
    .collect()

  const byPerson = new Map<string, number>()
  for (const payout of payouts) {
    if (payout.removed) continue

    byPerson.set(payout.personId, (byPerson.get(payout.personId) ?? 0) + payout.amountPaisa)
  }

  return byPerson
}
