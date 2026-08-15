// What a person is owed, and what the partnership owes altogether. Whole paisa throughout: a balance is a subtraction of two sums and there is nowhere for a fraction to enter.

export type Owed = { billedPaisa: number; paidPaisa: number }

/** What is still owed. Negative means they are holding an advance, which is a real position and not an error. */
export function outstandingPaisa(person: Owed): number {
  return person.billedPaisa - person.paidPaisa
}

// The positive balances only. An advance held by one man is not money available to pay another, and netting them would hide a real debt behind somebody else's credit -- which is why the workbooks keep MARKET PAYABLES and TOTAL RECEIVABLE on separate lines.
export function payablePaisa(people: Array<Owed>): number {
  return people.reduce((total, person) => total + Math.max(0, outstandingPaisa(person)), 0)
}

/** What is held in advance across everyone, as a positive figure. The other half of the pair, and never subtracted from the first. */
export function advancedPaisa(people: Array<Owed>): number {
  return people.reduce((total, person) => total + Math.max(0, -outstandingPaisa(person)), 0)
}
