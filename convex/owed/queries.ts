import { v } from 'convex/values'

import type { Line } from '../../shared/validation/owed'
import { advancedPaisa, payablePaisa, runningBalance } from '../../shared/validation/owed'
import { ledgerQuery } from '../utils/ledgerAccess'
import { whatEveryoneIsOwed } from './thePosition'

// One person's account, in the order the money happened: everything they have billed, everything they have been paid, and the balance after each line. This is what the `MR FARAN ACCOUNT` sheet is, and it is the question the workbooks were kept open to answer.

// Read by person rather than by site, because the debt is: a steel supplier delivering to two houses is owed one figure, not two halves somebody adds up.
export const statement = ledgerQuery({
  args: { personId: v.id('people') },
  handler: async (ctx, args) => {
    const person = await ctx.db.get('people', args.personId)

    // Said as an answer rather than as nothing, because the wrapper already returns nothing for a sign-in the ledger does not know. Two unknowns folded into one `null` is how a refusal reads as a spinner that never stops.
    if (person === null) return { account: null }

    const [bills, payments, sites] = await Promise.all([
      ctx.db
        .query('bills')
        .withIndex('byPersonAndDay', (q) => q.eq('personId', args.personId))
        .collect(),
      ctx.db
        .query('payments')
        .withIndex('byPaidToAndDay', (q) => q.eq('paidToId', args.personId))
        .collect(),
      ctx.db.query('sites').collect(),
    ])

    const houseNamed = new Map(sites.map((site) => [site._id, site.name]))
    const onWhichHouse = new Map<string, string>()
    const said = new Map<string, string | undefined>()

    const lines: Array<Line> = []

    for (const bill of bills) {
      if (bill.removed) continue

      lines.push({ what: 'billed', day: bill.day, amountPaisa: bill.amountPaisa, id: bill._id })
      onWhichHouse.set(bill._id, houseNamed.get(bill.siteId) ?? 'A house no longer in the list')
      said.set(bill._id, bill.description ?? bill.reference)
    }

    for (const payment of payments) {
      if (payment.removed) continue

      lines.push({ what: 'paid', day: payment.day, amountPaisa: payment.amountPaisa, id: payment._id })
      onWhichHouse.set(payment._id, houseNamed.get(payment.siteId) ?? 'A house no longer in the list')
      said.set(payment._id, payment.note ?? payment.reference)
    }

    const withBalances = runningBalance(lines).map((line) => ({
      ...line,
      onWhichHouse: onWhichHouse.get(line.id) ?? '',
      said: said.get(line.id),
    }))

    return {
      account: {
        name: person.name,
        phone: person.phone,
        // Newest first on the way out, because the last thing that happened is what he is looking for. The balance on each line was worked out forwards, which is the only way a running balance means anything.
        lines: withBalances.reverse(),
        billedPaisa: lines.reduce((sum, line) => (line.what === 'billed' ? sum + line.amountPaisa : sum), 0),
        paidPaisa: lines.reduce((sum, line) => (line.what === 'paid' ? sum + line.amountPaisa : sum), 0),
      },
    }
  },
})

// What is owed to everybody, across every house. A steel supplier delivering to two of them has one balance, not two halves somebody adds up in his head.

// A position rather than a list of rows: the question is what is owed this man today, and it has to be answerable without adding anything up by hand.
export const position = ledgerQuery({
  handler: async (ctx) => {
    const [bills, payments, people, sites] = await Promise.all([
      ctx.db.query('bills').collect(),
      ctx.db.query('payments').collect(),
      ctx.db.query('people').collect(),
      ctx.db.query('sites').collect(),
    ])

    // Worked out where the dashboard works it out, rather than beside it. Two copies of this arithmetic is how a tile and a screen come to disagree about a figure he is looking at twice.
    const everyone = whatEveryoneIsOwed(bills, payments, people, sites)

    return {
      everyone,
      // Two figures, never one. An advance held by one man is not money available to pay another.
      payablePaisa: payablePaisa(everyone),
      advancedPaisa: advancedPaisa(everyone),
    }
  },
})
