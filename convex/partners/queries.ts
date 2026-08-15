import type { Put, Share } from '../../shared/profitSplit'
import { proportionalTo, shareOut } from '../../shared/profitSplit'
import type { Id } from '../_generated/dataModel'
import type { SiteQueryCtx } from '../utils/siteAccess'
import { siteQuery } from '../utils/siteAccess'

// What every partner on a house has put in, what he is owed of the profit, what has gone back to him, and what is left. Nauman: "every partner will be given a profit based on their investment, which will be customisable. We should also maintain the amount due to the investor and already paid."

// A house has no profit to split until it is sold. Until then the money in it is capital at work, and a share of a figure that has not happened yet is owed to nobody: "the shareholder profits are calculated when a house is sold."

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

// One read of the money arriving, answering both questions asked of it: what the partners have put in, and what the house has brought in from anybody else.

// Profit is what the house brought in less what it cost. A partner's own money is funding rather than income, so it is not in it -- counting it would make a house look profitable the moment somebody funded it.
async function theMoneyOn(
  ctx: SiteQueryCtx
): Promise<{ capital: Array<Put>; profitPaisa: number; broughtInPaisa: number; spentPaisa: number }> {
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

  const putIn = new Map<Id<'people'>, number>()
  let broughtInPaisa = 0

  for (const one of arrived) {
    if (one.removed) continue

    if (one.why === 'partnerMoney') {
      putIn.set(one.fromId, (putIn.get(one.fromId) ?? 0) + one.amountPaisa)
    } else {
      broughtInPaisa += one.amountPaisa
    }
  }

  const spentPaisa = spent.filter((one) => !one.removed).reduce((total, one) => total + one.amountPaisa, 0)

  return {
    capital: [...putIn].map(([personId, paisa]) => ({ personId, paisa })),
    profitPaisa: broughtInPaisa - spentPaisa,
    broughtInPaisa,
    spentPaisa,
  }
}

// The money decides who is on this list, not a role: somebody who has put capital into a house is a partner in it whatever anybody remembered to write down. An agreed share puts them on it too, since agreeing a share is saying so out loud.
export const positions = siteQuery({
  handler: async (ctx) => {
    const { capital, profitPaisa, broughtInPaisa, spentPaisa } = await theMoneyOn(ctx)
    const agreed = await ctx.db
      .query('profitShares')
      .withIndex('bySite', (q) => q.eq('siteId', ctx.siteId))
      .collect()

    const shares: Array<Share> =
      agreed.length > 0
        ? agreed.map((one) => ({ personId: one.personId, basisPoints: one.basisPoints }))
        : proportionalTo(capital)

    const site = await ctx.db.get('sites', ctx.siteId)
    const sold = site?.stage === 'sold'

    // Nothing is due until it is sold. Not a small figure -- nothing.
    const due = new Map(sold ? shareOut(profitPaisa, shares).map((part) => [part.personId, part.paisa]) : [])
    const paid = await paidOutOn(ctx)

    // Anybody the money has touched, including somebody who has only ever been paid. Leaving them out is money leaving the ledger and appearing on no screen and in no total -- and it happens without anybody typing anything wrong, because a `moneyIn` row corrected to removed takes its owner out of `capital` and his payout with him.
    const everyone = new Set<string>([
      ...capital.map((put) => put.personId),
      ...shares.map((share) => share.personId),
      ...paid.keys(),
    ])

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
      sold,
      // Whether the shares were agreed or worked out from the money. A screen saying which is the difference between a figure somebody chose and one nobody has looked at.
      sharesAgreed: agreed.length > 0,
      // What a share would come to if the house sold today. Kept out of the positions above on purpose: it is a guess about a house still being built, and the moment it sits in the same column as what somebody is owed, one gets read for the other.

      // Gone entirely once the house is sold, because then there is a real figure and two of them side by side is the same confusion arriving by another door.
      ifItSoldToday: sold
        ? null
        : {
            profitPaisa,
            shares: shareOut(profitPaisa, shares).map((part) => ({
              personId: part.personId,
              name:
                positions.find((position) => position.personId === part.personId)?.name ??
                'Somebody no longer in the list',
              paisa: part.paisa,
            })),
          },
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
