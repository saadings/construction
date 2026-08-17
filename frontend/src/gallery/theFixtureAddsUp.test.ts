// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everythingAtOnce } from './fixtures'

// The Dashboard says the same money in several places at once: a tile, a chart header, the last column of a chart, a table of houses. In the app all of them come out of one pass over the same rows, so they cannot disagree. **In a fixture they are separate hand-written claims about the same money**, and nothing had ever asked whether they agreed.

// They did not. The months came to 24,510,000 against a tile saying 22,150,000, and the own-money months to 7,525,000 against a tile saying 6,540,000 -- on a ledger, on the screen he opens first. Anybody who reads that screen does the arithmetic in about four seconds.

// Nobody wrote a wrong number, which is the part worth keeping. It reconciled to the rupee until two of those months held a nought; `nothingMeansTwoThings` refused two noughts it cannot tell apart, and the fix for that gave them values without touching the totals. **A fix for one rule quietly breaking an invariant no rule held.**

// The screen has been redrawn to his design since, and the pairs it can contradict itself in have moved with it -- the month chart is now what came in against what went out, over a fixed window rather than the whole ledger. So these are the pairs today, and the fact that they had to be rewritten is the point: a rule tied to a shape is a rule the next redraw retires silently.
describe('the fixture the Dashboard is drawn from', () => {
  const what = everythingAtOnce()
  const sum = (figures: Array<number>) => figures.reduce((total, one) => total + one, 0)

  // Two rules that were here are gone, and their absence is the change worth reading. The category rows coming to what the tile says, and the last pair of columns being this month said again, are now true by how the fixture is built rather than by being asked afterwards.

  // They came out because `nothingMeansTwoThings` is the sharper instrument on that pair: it does not ask whether two figures agree today, it nudges one and watches whether the other moves. Two literals that agree are two claims; one figure read twice cannot disagree at all. An assertion that construction has already made true is an assertion that can never fail, which is the shape this repository keeps finding at the bottom of a passing suite.

  it('ends the month chart on this month', () => {
    // The month itself is still two claims -- a string in `thisMonth` and a string in the last row -- and a window ending on the wrong month draws six columns about a different half-year under a heading naming this one.
    expect(what.inAndOut[what.inAndOut.length - 1].month).toBe(what.thisMonth.month)
  })

  it('runs the months consecutively up to that one', () => {
    // A window with a month missing out of the middle draws a chart whose columns are not a run, and nothing on the picture would say so.
    const months = what.inAndOut.map((one) => one.month)
    const next = (month: string) => {
      const at = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7))

      return `${String(Math.floor(at / 12))}-${String((at % 12) + 1).padStart(2, '0')}`
    }

    expect(months.slice(1)).toEqual(months.slice(0, -1).map(next))
  })

  it('keeps the window inside the whole of the ledger', () => {
    // The window is six months and the tiles are everything since the beginning, so these are the one pair that must *not* be equal -- and the direction matters: a window larger than the whole says money arrived twice.
    expect(sum(what.inAndOut.map((one) => one.inPaisa))).toBeLessThan(what.comeIn.receivedPaisa)
    expect(sum(what.inAndOut.map((one) => one.outPaisa))).toBeLessThan(what.goneOutPaisa)
  })

  it('has houses that come to what the tiles say altogether', () => {
    // The table at the foot of the screen against the figures at the top of it, which is the arithmetic a person actually does: every house's spending is the whole of the spending.
    expect(sum(what.houses.map((house) => house.goneOutPaisa))).toBe(what.goneOutPaisa)
    expect(sum(what.houses.map((house) => house.comeInPaisa))).toBe(what.comeIn.receivedPaisa)
  })

  it('keeps his own money inside what came in', () => {
    // The sentence that stops the biggest figure on the screen reading as profit. Own money larger than the total is not a rounding slip, it is the two fields swapped.
    expect(what.comeIn.ownMoneyPaisa).toBeLessThan(what.comeIn.receivedPaisa)
  })

  it('has quiet days that are actually in the week before the day it is drawn for', () => {
    // A day after `asAt` in this list is a day nobody could have recorded on yet, and the row would be accusing him of missing tomorrow.
    const aWeekBefore = new Date(`${what.asAt}T00:00:00Z`)
    aWeekBefore.setUTCDate(aWeekBefore.getUTCDate() - 7)

    for (const day of what.quietDays) {
      expect(day < what.asAt, `${day} is before ${what.asAt}`).toBe(true)
      expect(day >= aWeekBefore.toISOString().slice(0, 10), `${day} is inside the week`).toBe(true)
    }
  })

  it('gives every figure it draws one of its own', () => {
    // The control that already existed on the unit fixture, brought to the one that gets photographed. Two ideas sharing a figure is how an assertion finds the wrong one, and how a wiring bug looks like a working screen.

    // The pairs asserted equal above are deliberately not in here -- they are one figure drawn twice on purpose, which is the difference between a duplicate and a collision.
    const figures = [
      what.owed.payablePaisa,
      what.owed.advancedPaisa,
      what.goneOutPaisa,
      what.comeIn.receivedPaisa,
      what.comeIn.ownMoneyPaisa,
      // Worked out by the screen and drawn on it, so it can collide like any of the others.
      what.comeIn.receivedPaisa - what.goneOutPaisa,
      ...what.whereItWent.map((one) => one.paisa),
      ...what.inAndOut.slice(0, -1).flatMap((one) => [one.inPaisa, one.outPaisa]),
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
    expect(what.inAndOut.length).toBeGreaterThan(3)
    expect(what.whereItWent.length).toBeGreaterThan(3)
    expect(what.houses.length).toBeGreaterThan(2)
    expect(what.quietDays.length).toBeGreaterThan(0)
    expect(what.comeIn.receivedPaisa).toBeGreaterThan(0)
    expect(what.thisMonth.paidOutPaisa).toBeGreaterThan(0)
  })
})
