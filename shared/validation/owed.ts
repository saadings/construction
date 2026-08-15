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

// One line of somebody's account: a bill raising what they are owed, or a payment settling it.
export type Line = {
  what: 'billed' | 'paid'
  day: string
  amountPaisa: number
  // Steady between two lines alike in day and amount, so a statement reads the same twice.
  id: string
}

export type LineWithBalance = Line & { balancePaisa: number }

// The statement, in the order the money happened. The `MR FARAN ACCOUNT` sheet reads exactly this way, and the balance after each line is the column somebody runs a finger down.

// Oldest first here, because a running balance only means anything read forwards. Which end the screen shows first is the screen's business.
export function runningBalance(lines: Array<Line>): Array<LineWithBalance> {
  const inOrder = [...lines].sort(
    (one, other) =>
      one.day.localeCompare(other.day) || one.amountPaisa - other.amountPaisa || one.id.localeCompare(other.id)
  )

  let balancePaisa = 0

  return inOrder.map((line) => {
    balancePaisa += line.what === 'billed' ? line.amountPaisa : -line.amountPaisa

    return { ...line, balancePaisa }
  })
}
