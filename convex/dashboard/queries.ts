import { advancedPaisa, payablePaisa } from '../../shared/validation/owed'
import type { Doc, Id } from '../_generated/dataModel'
import { whatEveryoneIsOwed } from '../owed/thePosition'
import { acrossEveryHouse } from './acrossEveryHouse'

// Every figure on the dashboard is one the ledger already answers. Nothing is invented for a tile: a number nobody could go and find the rows behind is a number nobody can act on.

// One reading rather than six. The tiles are read at a glance and compared against each other, so they have to come from one pass over the same rows -- six readings can each be right and still disagree, which is the whole class of defect this ledger keeps finding.

/** How many trades are named before the rest are gathered into one. Six fits the design and the seventh onwards is a tail nobody reads individually. */
const TRADES_NAMED = 6

export type WhereItWent = { tradeId: Id<'trades'> | null; name: string; paisa: number }
export type WhatCameIn = { month: string; ownMoneyPaisa: number; broughtInPaisa: number }
export type OneHouse = {
  siteId: Id<'sites'>
  name: string
  stage: Doc<'sites'>['stage']
  goneOutPaisa: number
  comeInPaisa: number
}

function byTrade(payments: Array<Doc<'payments'>>, trades: Array<Doc<'trades'>>): Array<WhereItWent> {
  const named = new Map(trades.map((trade) => [trade._id, trade.name]))
  const totals = new Map<Id<'trades'>, number>()

  for (const payment of payments) {
    if (payment.removed) continue

    totals.set(payment.tradeId, (totals.get(payment.tradeId) ?? 0) + payment.amountPaisa)
  }

  const all = [...totals]
    .map(([tradeId, paisa]) => ({ tradeId, name: named.get(tradeId) ?? 'No longer on the list', paisa }))
    // Most spent first, then by name, so two trades alike in figure read the same way twice.
    .sort((one, other) => other.paisa - one.paisa || one.name.localeCompare(other.name))

  if (all.length <= TRADES_NAMED + 1) {
    return all
  }

  // The tail gathered rather than cut. A chart that silently drops what does not fit says the house cost less than it did.
  const rest = all.slice(TRADES_NAMED)

  return [
    ...all.slice(0, TRADES_NAMED),
    { tradeId: null, name: `Everything else (${rest.length})`, paisa: rest.reduce((sum, one) => sum + one.paisa, 0) },
  ]
}

function byMonth(received: Array<Doc<'moneyIn'>>): Array<WhatCameIn> {
  const months = new Map<string, { ownMoneyPaisa: number; broughtInPaisa: number }>()

  for (const one of received) {
    if (one.removed) continue

    // The day is already `YYYY-MM-DD`, so the month is the first seven characters of it and no date is ever built to find that out.
    const month = one.day.slice(0, 7)
    const running = months.get(month) ?? { ownMoneyPaisa: 0, broughtInPaisa: 0 }

    // Kept apart all the way to the chart. A partner putting his share in is funding the house; what a client pays and what a sale brings is what the house brought in, and one bar holding both says a house is doing well the moment somebody funds it.
    if (one.why === 'partnerMoney') {
      running.ownMoneyPaisa += one.amountPaisa
    } else {
      running.broughtInPaisa += one.amountPaisa
    }

    months.set(month, running)
  }

  return [...months]
    .map(([month, sums]) => ({ month, ...sums }))
    .sort((one, other) => one.month.localeCompare(other.month))
}

export const whatIsHappening = acrossEveryHouse({
  handler: async (ctx) => {
    const [bills, payments, people, sites, trades, received] = await Promise.all([
      ctx.db.query('bills').collect(),
      ctx.db.query('payments').collect(),
      ctx.db.query('people').collect(),
      ctx.db.query('sites').collect(),
      ctx.db.query('trades').collect(),
      ctx.db.query('moneyIn').collect(),
    ])

    const everyone = whatEveryoneIsOwed(bills, payments, people, sites)
    const standing = payments.filter((payment) => !payment.removed)
    const arrived = received.filter((one) => !one.removed)

    const goneOutOn = new Map<Id<'sites'>, number>()
    for (const payment of standing) {
      goneOutOn.set(payment.siteId, (goneOutOn.get(payment.siteId) ?? 0) + payment.amountPaisa)
    }

    const comeInOn = new Map<Id<'sites'>, number>()
    for (const one of arrived) {
      comeInOn.set(one.siteId, (comeInOn.get(one.siteId) ?? 0) + one.amountPaisa)
    }

    const ownMoneyPaisa = arrived
      .filter((one) => one.why === 'partnerMoney')
      .reduce((total, one) => total + one.amountPaisa, 0)

    const houses: Array<OneHouse> = sites
      .filter((site) => !site.hidden)
      .map((site) => ({
        siteId: site._id,
        name: site.name,
        stage: site.stage,
        goneOutPaisa: goneOutOn.get(site._id) ?? 0,
        comeInPaisa: comeInOn.get(site._id) ?? 0,
      }))
      // Most spent first: the house taking the money is the house he is thinking about.
      .sort((one, other) => other.goneOutPaisa - one.goneOutPaisa || one.name.localeCompare(other.name))

    return {
      owed: {
        // Two figures, never one. An advance held by the tile man is not money available to pay the steel man.
        payablePaisa: payablePaisa(everyone),
        advancedPaisa: advancedPaisa(everyone),
      },
      goneOutPaisa: standing.reduce((total, payment) => total + payment.amountPaisa, 0),
      comeIn: {
        receivedPaisa: arrived.reduce((total, one) => total + one.amountPaisa, 0),
        // Said beside the figure it is part of, because without it the biggest number on the screen reads as profit.
        ownMoneyPaisa,
      },
      whereItWent: byTrade(payments, trades),
      whatCameIn: byMonth(received),
      houses,
      // His first day is one house with nothing in it. A dashboard that draws charts over four zeroes is what everybody ships, so the screen is told plainly rather than working it out from six figures.
      nothingYet: standing.length === 0 && arrived.length === 0,
    }
  },
})
