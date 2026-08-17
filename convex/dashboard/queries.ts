import { v } from 'convex/values'

import { advancedPaisa, outstandingPaisa, payablePaisa } from '../../shared/validation/owed'
import type { Doc, Id } from '../_generated/dataModel'
import { whatEveryoneIsOwed } from '../owed/thePosition'
import { acrossEveryHouse } from './acrossEveryHouse'

// Every figure on the dashboard is one the ledger already answers. Nothing is invented for a tile: a number nobody could go and find the rows behind is a number nobody can act on.

// One reading rather than six. The tiles are read at a glance and compared against each other, so they have to come from one pass over the same rows -- six readings can each be right and still disagree, which is the whole class of defect this ledger keeps finding.

/** How many trades are named before the rest are gathered into one. Six fits the design and the seventh onwards is a tail nobody reads individually. */
const TRADES_NAMED = 6

/** How many months the in-and-out chart shows. His drawing has six of them and the axis has room for six labels. */
const MONTHS_ON_THE_CHART = 6

// How far back the quiet-day row looks. A week is a run somebody would notice having missed; a month of it is a different sentence, and one nobody would act on.
const A_RUN_OF_DAYS = 7

export type WhereItWent = { tradeId: Id<'trades'> | null; name: string; paisa: number }
export type InAndOut = { month: string; inPaisa: number; outPaisa: number }
export type OneHouse = {
  siteId: Id<'sites'>
  name: string
  stage: Doc<'sites'>['stage']
  // Both, and not one standing in for the other. `forWhom` is null on a house going up to sell **and** on a house built for somebody whose name nobody has entered yet, and those are two different sentences -- `Own build, for sale` against `For a client`. Collapsing them is the not-there reading as a value that this ledger keeps finding.
  builtForAClient: boolean
  /** Who it is being built for, when that is somebody and that somebody is named. */
  forWhom: string | null
  coveredAreaSqft: number | null
  goneOutPaisa: number
  comeInPaisa: number
}

/** The month a day falls in. A day is already `YYYY-MM-DD`, so this is its first seven characters and no date is ever built to find out. */
function monthOf(day: string): string {
  return day.slice(0, 7)
}

/** The months ending with this one, oldest first, said as `YYYY-MM`. Counted by arithmetic on the number rather than by stepping a `Date`, so no timezone can move a month. */
export function theMonthsEndingWith(month: string, howMany: number): Array<string> {
  const year = Number(month.slice(0, 4))
  const at = Number(month.slice(5, 7))
  const months: Array<string> = []

  for (let back = howMany - 1; back >= 0; back -= 1) {
    // Zero-based so the arithmetic wraps a year without a special case, then put back.
    const index = year * 12 + (at - 1) - back

    months.push(`${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, '0')}`)
  }

  return months
}

// The days nothing was recorded on. This is the one row of his `Needs your attention` the ledger can answer today: the other two need a due date on a bill and an estimate on a site, and neither exists.

// Counted back from today, and today itself is left out -- a day is not missing until it is over. Stepped through UTC rather than through the local clock, for the reason `asCalendarDate` exists: rebuilding a day at local midnight is how it becomes the day before.

// It stops at the first day anything was recorded on. A day before this ledger held anything is not a day somebody forgot, and without that line the row greets a new ledger by accusing its owner of a week of neglect on the afternoon he starts.
export function theDaysWithNothingOnThem(today: string, days: Iterable<string>, howFarBack: number): Array<string> {
  const recorded = new Set(days)
  const quiet: Array<string> = []
  const from = new Date(`${today}T00:00:00Z`)

  if (recorded.size === 0 || Number.isNaN(from.getTime())) return []

  const began = [...recorded].reduce((earliest, day) => (day < earliest ? day : earliest))

  for (let back = howFarBack; back >= 1; back -= 1) {
    const then = new Date(from)
    then.setUTCDate(then.getUTCDate() - back)
    const day = then.toISOString().slice(0, 10)

    if (day >= began && !recorded.has(day)) {
      quiet.push(day)
    }
  }

  return quiet
}

function byTrade(payments: Array<Doc<'payments'>>, trades: Array<Doc<'trades'>>): Array<WhereItWent> {
  const named = new Map(trades.map((trade) => [trade._id, trade.name]))
  const totals = new Map<Id<'trades'>, number>()

  for (const payment of payments) {
    totals.set(payment.tradeId, (totals.get(payment.tradeId) ?? 0) + payment.amountPaisa)
  }

  const all = [...totals]
    .map(([tradeId, paisa]) => ({ tradeId, name: named.get(tradeId) ?? 'No longer on the list', paisa }))
    // Most spent first, then by name, so two trades alike in figure read the same way twice.
    .sort((one, other) => other.paisa - one.paisa || one.name.localeCompare(other.name))

  if (all.length <= TRADES_NAMED + 1) {
    return all
  }

  // The tail gathered rather than cut. A chart that silently drops what does not fit says the month cost less than it did.
  const rest = all.slice(TRADES_NAMED)

  return [
    ...all.slice(0, TRADES_NAMED),
    { tradeId: null, name: `Everything else (${rest.length})`, paisa: rest.reduce((sum, one) => sum + one.paisa, 0) },
  ]
}

// What arrived and what left, month by month, over a fixed window rather than over whatever months happen to hold rows. A chart drawn from the rows alone silently skips a month nothing happened in, which is the month worth seeing.

// This replaces a chart splitting what came in into his own money and what the houses brought. That split is a real distinction and it is not the one he drew here -- it is on `Reports`, and the tile below still says how much of what came in was his.
function inAndOutByMonth(
  months: Array<string>,
  payments: Array<Doc<'payments'>>,
  received: Array<Doc<'moneyIn'>>
): Array<InAndOut> {
  const running = new Map<string, InAndOut>(months.map((month) => [month, { month, inPaisa: 0, outPaisa: 0 }]))

  for (const one of received) {
    const month = running.get(monthOf(one.day))
    if (month !== undefined) month.inPaisa += one.amountPaisa
  }

  for (const payment of payments) {
    const month = running.get(monthOf(payment.day))
    if (month !== undefined) month.outPaisa += payment.amountPaisa
  }

  return months.map((month) => running.get(month) ?? { month, inPaisa: 0, outPaisa: 0 })
}

export const whatIsHappening = acrossEveryHouse({
  // Handed in rather than read here. A query asking the clock re-answers on its own and cannot be tested against a fixed day, and the day that matters is the one on the device somebody is holding -- which is a different day from the server's for a third of every night in Lahore.
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const [bills, payments, people, sites, trades, received, roles] = await Promise.all([
      ctx.db.query('bills').collect(),
      ctx.db.query('payments').collect(),
      ctx.db.query('people').collect(),
      ctx.db.query('sites').collect(),
      ctx.db.query('trades').collect(),
      ctx.db.query('moneyIn').collect(),
      ctx.db.query('siteRoles').collect(),
    ])

    const everyone = whatEveryoneIsOwed(bills, payments, people, sites)
    const standing = payments.filter((payment) => !payment.removed)
    const arrived = received.filter((one) => !one.removed)

    const thisMonth = monthOf(today)
    const paidOutThisMonth = standing.filter((payment) => monthOf(payment.day) === thisMonth)
    const receivedThisMonth = arrived.filter((one) => monthOf(one.day) === thisMonth)

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

    // Whose house it is being built for, for the line under its name. A client is a capacity somebody holds on one house, so this is the roles table and not a field on the site.
    const named = new Map(people.map((person) => [person._id, person.name]))
    const clientOf = new Map<Id<'sites'>, string>()
    for (const role of roles) {
      if (role.capacity !== 'client') continue

      const name = named.get(role.personId)
      // The first named client only. A house with two owners on it is a sentence, not a subtitle, and the house's own screen is where that is said.
      if (name !== undefined && !clientOf.has(role.siteId)) clientOf.set(role.siteId, name)
    }

    const houses: Array<OneHouse> = sites
      .filter((site) => !site.hidden)
      .map((site) => ({
        siteId: site._id,
        name: site.name,
        stage: site.stage,
        builtForAClient: site.builtForAClient,
        forWhom: site.builtForAClient ? (clientOf.get(site._id) ?? null) : null,
        coveredAreaSqft: site.coveredAreaSqft ?? null,
        goneOutPaisa: goneOutOn.get(site._id) ?? 0,
        comeInPaisa: comeInOn.get(site._id) ?? 0,
      }))
      // Most spent first: the house taking the money is the house he is thinking about.
      .sort((one, other) => other.goneOutPaisa - one.goneOutPaisa || one.name.localeCompare(other.name))

    return {
      // Echoed back rather than worked out again on the screen. The heading says which day these figures are as at, and a heading naming a different day from the one they were counted for is worse than no heading.
      asAt: today,
      owed: {
        // Two figures, never one. An advance held by the tile man is not money available to pay the steel man.
        payablePaisa: payablePaisa(everyone),
        advancedPaisa: advancedPaisa(everyone),
        // How many people that is owed to, which is what his tile says under the figure.
        people: everyone.filter((person) => outstandingPaisa(person) > 0).length,
      },
      goneOutPaisa: standing.reduce((total, payment) => total + payment.amountPaisa, 0),
      comeIn: {
        receivedPaisa: arrived.reduce((total, one) => total + one.amountPaisa, 0),
        // Said beside the figure it is part of, because without it the biggest number on the screen reads as profit.
        ownMoneyPaisa,
      },
      thisMonth: {
        month: thisMonth,
        paidOutPaisa: paidOutThisMonth.reduce((total, payment) => total + payment.amountPaisa, 0),
        // The count under the figure in his drawing: `Across 47 entries`. It is what tells him whether a heavy month was one cheque or forty.
        entries: paidOutThisMonth.length,
        receivedPaisa: receivedThisMonth.reduce((total, one) => total + one.amountPaisa, 0),
      },
      // Scoped to this month, as his heading says -- `By category, March 2025`. Where the money has gone since the beginning is a different question and it is on `Reports`.
      whereItWent: byTrade(paidOutThisMonth, trades),
      inAndOut: inAndOutByMonth(theMonthsEndingWith(thisMonth, MONTHS_ON_THE_CHART), standing, arrived),
      // The one row of `Needs your attention` this ledger can answer. His other two rows need a due date on a bill and an estimate on a site, and until those exist the shapes stand empty rather than being filled with something invented.
      quietDays: theDaysWithNothingOnThem(
        today,
        [...standing.map((payment) => payment.day), ...arrived.map((one) => one.day)],
        A_RUN_OF_DAYS
      ),
      houses,
      // His first day is one house with nothing in it. A dashboard that draws charts over four zeroes is what everybody ships, so the screen is told plainly rather than working it out from six figures.
      nothingYet: standing.length === 0 && arrived.length === 0,
    }
  },
})
