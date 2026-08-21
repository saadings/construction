import type { Id } from '../_generated/dataModel'
import { whatEveryoneIsOwed } from '../owed/thePosition'
import { ledgerQuery } from '../utils/ledgerAccess'

// Everyone, in the order a person would look for them. Hidden ones are gone from every list but still named on the payments that point at them.
export const list = ledgerQuery({
  handler: async (ctx) => {
    const everyone = await ctx.db.query('people').withIndex('byName').collect()

    return everyone.filter((person) => !person.hidden)
  },
})

// The two kinds his drawing splits People into, and they are not the same ledger.

// Money goes **out** to the trade: a supplier or a subcontractor carries a balance we owe, which is billed less paid. Money comes **in** from partners and clients. The same person can be on both sides -- on his own house a man is partner and client at once -- so this is two readings of everybody rather than a division of them.

// Nobody's side is stored. It is what they have done: somebody we have billed is somebody we pay, and somebody money has come in from is somebody who puts money in. `people` says deliberately nothing about roles, and the day it did, a man who is both would be unrecordable.
export const bothSides = ledgerQuery({
  handler: async (ctx) => {
    const [people, bills, payments, sites, received, roles, engagements, trades] = await Promise.all([
      ctx.db.query('people').withIndex('byName').collect(),
      ctx.db.query('bills').collect(),
      ctx.db.query('payments').collect(),
      ctx.db.query('sites').collect(),
      ctx.db.query('moneyIn').collect(),
      ctx.db.query('siteRoles').collect(),
      ctx.db.query('engagements').collect(),
      ctx.db.query('trades').collect(),
    ])

    const here = people.filter((person) => !person.hidden)
    const named = new Map(here.map((person) => [person._id, person]))

    // The same arithmetic the owed screen and the dashboard read, rather than a third copy of it. Two sums of one thing is how two screens come to disagree about a figure he is looking at twice.
    const standing = whatEveryoneIsOwed(bills, payments, people, sites)

    const tradeNamed = new Map(trades.map((trade) => [trade._id, trade.name]))
    const doing = new Map<Id<'people'>, string>()
    for (const engagement of engagements) {
      if (engagement.hidden) continue

      const trade = tradeNamed.get(engagement.tradeId)
      if (trade !== undefined) doing.set(engagement.personId, trade)
    }

    const capacity = new Map<Id<'people'>, 'partner' | 'investor' | 'client'>()
    for (const role of roles) {
      // A partner on any house is a partner, whatever else he is elsewhere: the strongest thing said about somebody is what the pill says.
      const already = capacity.get(role.personId)
      if (already === 'partner') continue

      capacity.set(role.personId, role.capacity)
    }

    const inFrom = new Map<Id<'people'>, number>()

    // What the money was, kept beside how much of it there was. `siteRoles` is empty on his real ledger, so a card whose pill came only from a role would be blank for everybody -- and `why` is the better answer anyway: it is asked at the time rather than inferred from the person, which is the whole reason that field exists.
    const cameAs = new Map<Id<'people'>, 'partner' | 'client'>()

    for (const one of received) {
      if (one.removed) continue

      inFrom.set(one.fromId, (inFrom.get(one.fromId) ?? 0) + one.amountPaisa)

      // A man who has ever put his own money in is a partner on this screen, whatever else he has also done. On his own house he is both, and the stronger of the two is what the pill says.
      const already = cameAs.get(one.fromId)
      if (already === 'partner') continue

      cameAs.set(one.fromId, one.why === 'partnerMoney' ? 'partner' : 'client')
    }

    const weOwe = standing
      .filter((person) => named.has(person.personId))
      .filter((person) => person.billedPaisa > 0 || person.paidPaisa > 0)
      .map((person) => ({
        personId: person.personId,
        name: person.name,
        phone: named.get(person.personId)?.phone,
        // What they do on a house, or what they are to it. `Trade or role` is his own column heading, and it is one question with two answers depending on which side somebody is on.
        doing: doing.get(person.personId) ?? capacity.get(person.personId),
        billedPaisa: person.billedPaisa,
        paidPaisa: person.paidPaisa,
        outstandingPaisa: person.outstandingPaisa,
      }))

    const putIn = [...inFrom]
      .filter(([personId]) => named.has(personId))
      .map(([personId, paisa]) => ({
        personId,
        name: named.get(personId)?.name ?? 'Somebody no longer in the list',
        phone: named.get(personId)?.phone,
        // Partner or client, derived rather than stored -- from what he was put down as on a house where that is written, and otherwise from what his money was said to be.
        role: capacity.get(personId) === 'partner' ? 'partner' : (cameAs.get(personId) ?? capacity.get(personId)),
        inPaisa: paisa,
      }))
      // Most in first: the man who has funded the most is the one asked about.
      .sort((one, other) => other.inPaisa - one.inPaisa || one.name.localeCompare(other.name))

    return {
      weOwe,
      putIn,
      // The two figures his headings carry, each the sum of the rows under it rather than a separate reading.
      owedPaisa: weOwe.reduce(
        (total, person) => (person.outstandingPaisa > 0 ? total + person.outstandingPaisa : total),
        0
      ),
      inPaisa: putIn.reduce((total, person) => total + person.inPaisa, 0),
      // Everybody, for the screen that also has to let somebody be added and corrected. A person nobody has billed and nobody has paid is on neither list above and still has to be reachable.
      everyone: here.map((person) => ({ _id: person._id, name: person.name, phone: person.phone })),
    }
  },
})
