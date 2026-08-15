import { advancedPaisa, outstandingPaisa, payablePaisa } from '../../shared/validation/owed'
import type { Id } from '../_generated/dataModel'
import { ledgerQuery } from '../utils/ledgerAccess'

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

    const named = new Map(people.map((person) => [person._id, person.name]))
    const houseNamed = new Map(sites.map((site) => [site._id, site.name]))

    type Running = { billedPaisa: number; paidPaisa: number; onHouses: Map<Id<'sites'>, Running> }
    const empty = (): Running => ({ billedPaisa: 0, paidPaisa: 0, onHouses: new Map() })

    const running = new Map<Id<'people'>, Running>()
    const forPerson = (personId: Id<'people'>) => {
      const already = running.get(personId) ?? empty()
      running.set(personId, already)
      return already
    }
    const onHouse = (person: Running, siteId: Id<'sites'>) => {
      const already = person.onHouses.get(siteId) ?? empty()
      person.onHouses.set(siteId, already)
      return already
    }

    for (const bill of bills) {
      if (bill.removed) continue
      const person = forPerson(bill.personId)
      person.billedPaisa += bill.amountPaisa
      onHouse(person, bill.siteId).billedPaisa += bill.amountPaisa
    }

    // A payment with nobody named on it was money handed over at a shop and is nobody's account. It still left the site, which the site's own totals already say.
    for (const payment of payments) {
      if (payment.removed || payment.paidToId === undefined) continue
      const person = forPerson(payment.paidToId)
      person.paidPaisa += payment.amountPaisa
      onHouse(person, payment.siteId).paidPaisa += payment.amountPaisa
    }

    const everyone = [...running].map(([personId, sums]) => ({
      personId,
      name: named.get(personId) ?? 'Somebody no longer in the list',
      billedPaisa: sums.billedPaisa,
      paidPaisa: sums.paidPaisa,
      outstandingPaisa: outstandingPaisa(sums),
      onHouses: [...sums.onHouses]
        .map(([siteId, house]) => ({
          siteId,
          name: houseNamed.get(siteId) ?? 'A house no longer in the list',
          billedPaisa: house.billedPaisa,
          paidPaisa: house.paidPaisa,
          outstandingPaisa: outstandingPaisa(house),
        }))
        // Largest owed first, then by name, then by id: two houses alike in every figure read the same way twice.
        .sort(
          (one, other) =>
            other.outstandingPaisa - one.outstandingPaisa ||
            one.name.localeCompare(other.name) ||
            one.siteId.localeCompare(other.siteId)
        ),
    }))

    return {
      // Owed the most first, because that is who is asked about. Ties settled by name and then id so the list reads the same twice.
      everyone: everyone.sort(
        (one, other) =>
          other.outstandingPaisa - one.outstandingPaisa ||
          one.name.localeCompare(other.name) ||
          one.personId.localeCompare(other.personId)
      ),
      // Two figures, never one. An advance held by one man is not money available to pay another.
      payablePaisa: payablePaisa(everyone),
      advancedPaisa: advancedPaisa(everyone),
    }
  },
})
