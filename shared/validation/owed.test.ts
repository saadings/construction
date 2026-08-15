import { describe, expect, it } from 'vitest'

import { advancedPaisa, outstandingPaisa, payablePaisa } from './owed'

const owedALot = { billedPaisa: 763_701_00, paidPaisa: 0 }
const holdingAnAdvance = { billedPaisa: 100_000_00, paidPaisa: 250_000_00 }
const settled = { billedPaisa: 500_000_00, paidPaisa: 500_000_00 }

describe('what one person is owed', () => {
  it('is what they were billed less what they were paid', () => {
    expect(outstandingPaisa(owedALot)).toBe(763_701_00)
  })

  it('is negative when they are holding an advance, rather than nothing', () => {
    // ADV and BL PMT run through the workbooks. An advance is a real position and clamping it at zero would lose money nobody could then find.
    expect(outstandingPaisa(holdingAnAdvance)).toBe(-150_000_00)
  })

  it('is nothing when it is settled, which is not the same as having no dealings', () => {
    expect(outstandingPaisa(settled)).toBe(0)
  })
})

describe('what the partnership owes altogether', () => {
  it('adds up what is owed and leaves out what is held', () => {
    // Netting would hide a real debt behind somebody else's credit, which is why the workbooks keep the two on separate lines.
    expect(payablePaisa([owedALot, holdingAnAdvance, settled])).toBe(763_701_00)
  })

  it('reports what is held in advance as its own figure', () => {
    expect(advancedPaisa([owedALot, holdingAnAdvance, settled])).toBe(150_000_00)
  })

  it('never nets the two against each other', () => {
    // The control. A single netted figure would read 613,701 here and hide the fact that one man is owed 763,701 today.
    const netted = payablePaisa([owedALot, holdingAnAdvance]) - advancedPaisa([owedALot, holdingAnAdvance])

    expect(payablePaisa([owedALot, holdingAnAdvance])).toBe(763_701_00)
    expect(netted).not.toBe(payablePaisa([owedALot, holdingAnAdvance]))
  })

  it('is nothing when nobody is owed anything', () => {
    expect(payablePaisa([])).toBe(0)
    expect(advancedPaisa([settled])).toBe(0)
  })

  it('stays whole paisa, because it is only ever additions and one subtraction', () => {
    const odd = [
      { billedPaisa: 1, paidPaisa: 3 },
      { billedPaisa: 7, paidPaisa: 2 },
    ]

    expect(Number.isInteger(payablePaisa(odd))).toBe(true)
    expect(Number.isInteger(advancedPaisa(odd))).toBe(true)
  })
})
