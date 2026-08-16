import { outstandingPaisa } from '../../shared/validation/owed'
import type { Doc, Id } from '../_generated/dataModel'

// What everybody is owed, worked out once. The Owed screen reads it per person with the houses under each, and the dashboard reads the two totals off the same pass -- because a tile and a screen answering the same question from two copies of the arithmetic is how they come to disagree about a figure he is looking at twice.

export type OnAHouse = {
  siteId: Id<'sites'>
  name: string
  billedPaisa: number
  paidPaisa: number
  outstandingPaisa: number
}

export type WhatOneIsOwed = {
  personId: Id<'people'>
  name: string
  billedPaisa: number
  paidPaisa: number
  outstandingPaisa: number
  onHouses: Array<OnAHouse>
}

type Running = { billedPaisa: number; paidPaisa: number; onHouses: Map<Id<'sites'>, Running> }

export function whatEveryoneIsOwed(
  bills: Array<Doc<'bills'>>,
  payments: Array<Doc<'payments'>>,
  people: Array<Doc<'people'>>,
  sites: Array<Doc<'sites'>>
): Array<WhatOneIsOwed> {
  const named = new Map(people.map((person) => [person._id, person.name]))
  const houseNamed = new Map(sites.map((site) => [site._id, site.name]))

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

  return (
    [...running]
      .map(([personId, sums]) => ({
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
      // Owed the most first, because that is who is asked about. Ties settled by name and then id so the list reads the same twice.
      .sort(
        (one, other) =>
          other.outstandingPaisa - one.outstandingPaisa ||
          one.name.localeCompare(other.name) ||
          one.personId.localeCompare(other.personId)
      )
  )
}
