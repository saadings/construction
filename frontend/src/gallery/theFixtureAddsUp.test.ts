// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { EVERYTHING_AT_ONCE } from './fixtures'

// The Dashboard says what has come in altogether on a tile, and where it came from in the months underneath. In the app both come out of one pass over the same rows, so they cannot disagree. **In a fixture they are two hand-written claims about the same money**, and nothing had ever asked whether they agreed.

// They did not. The months came to 24,510,000 against a tile saying 22,150,000, and the own-money months to 7,525,000 against a tile saying 6,540,000 -- on a ledger, on the tile called `Not yet spent`, on the screen he opens first. Anybody who reads that screen does the arithmetic in about four seconds.

// Nobody wrote a wrong number, which is the part worth keeping. It reconciled to the rupee until two of those months held a nought; `nothingMeansTwoThings` refused two noughts it cannot tell apart, and the fix for that gave them values without touching the totals. **A fix for one rule quietly breaking an invariant no rule held.**

// So the invariant is a rule now. It is worth having beyond the fixture: a fixture that contradicts itself cannot catch the app contradicting itself, which is the whole reason the single pass in `dashboard/queries.ts` was worth writing.
describe('the fixture the Dashboard is drawn from', () => {
  const what = EVERYTHING_AT_ONCE

  it('has months that come to what the tile says has come in', () => {
    const months = what.whatCameIn.reduce((total, one) => total + one.ownMoneyPaisa + one.broughtInPaisa, 0)

    expect(months).toBe(what.comeIn.receivedPaisa)
  })

  it('has own-money months that come to what the tile says is his own', () => {
    // Asked separately, because the two halves can be wrong in opposite directions and cancel: a month with too much own money and too little brought in leaves the grand total right and the sentence under the tile wrong.
    const own = what.whatCameIn.reduce((total, one) => total + one.ownMoneyPaisa, 0)

    expect(own).toBe(what.comeIn.ownMoneyPaisa)
  })

  it('has trade rows that come to what the tile says has gone out', () => {
    // The same question on the other side of the screen, and this half was already true -- which is why it is worth asserting rather than assuming: it is the half that shows what the invariant looks like when nobody has broken it.
    const trades = what.whereItWent.reduce((total, one) => total + one.paisa, 0)

    expect(trades).toBe(what.goneOutPaisa)
  })

  it('gives every figure it draws one of its own', () => {
    // The control that already existed on the unit fixture, brought to the one that gets photographed. Two ideas sharing a figure is how an assertion finds the wrong one, and how a wiring bug looks like a working screen.
    const figures = [
      what.owed.payablePaisa,
      what.owed.advancedPaisa,
      what.goneOutPaisa,
      what.comeIn.receivedPaisa,
      what.comeIn.ownMoneyPaisa,
      // Worked out by the screen and drawn on it, so it can collide like any of the others.
      what.comeIn.receivedPaisa - what.goneOutPaisa,
      ...what.whereItWent.map((one) => one.paisa),
      ...what.whatCameIn.flatMap((one) => [one.ownMoneyPaisa, one.broughtInPaisa]),
      ...what.houses.flatMap((house) => [house.goneOutPaisa, house.comeInPaisa]),
    ]

    // One nought is spent on purpose -- a house started with nothing entered against it, which is the state he is in on his first day -- and it is drawn twice by that house's two columns. Everything else is its own figure.
    const noughts = figures.filter((figure) => figure === 0)
    const rest = figures.filter((figure) => figure !== 0)

    expect(noughts).toHaveLength(2)
    expect(new Set(rest).size).toBe(rest.length)
  })

  it('is reading a fixture with something in it, rather than agreeing with an empty one', () => {
    // Every sum above is `0 === 0` against a fixture that lost its rows, which is the cleanest pass in this file and says nothing.
    expect(what.whatCameIn.length).toBeGreaterThan(3)
    expect(what.whereItWent.length).toBeGreaterThan(3)
    expect(what.comeIn.receivedPaisa).toBeGreaterThan(0)
  })
})
