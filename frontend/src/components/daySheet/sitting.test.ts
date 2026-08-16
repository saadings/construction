// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_PAISA } from '~shared/money'

import type { Draft } from './sitting'
import { anEmptyDraft, paisaIn, sittingTotalPaisa } from './sitting'

// Nauman typed `111,111,111,111` into a day sheet. `This sitting` read `0`, his figure was still in the box, and nothing said why.

// Nothing was broken upstream: `readRupees` had already decided it was `largerThanWeKeep` and said so. `paisaIn` caught the refusal and returned a number, and a total is a figure people trust -- so the screen said his payment was worth nothing.

// Ids the way every other test here makes them: they are branded so a screen cannot hand a mutation a string it made up, and a fixture is the one place that brand has to be asserted rather than earned.
function aLine(over: Partial<Draft> = {}): Draft {
  return anEmptyDraft({
    tradeId: 't1' as Draft['tradeId'],
    paidToId: 'p1' as Draft['paidToId'],
    amount: '25000',
    ...over,
  })
}

describe('what a line of a sitting is worth', () => {
  it('is the figure, when the figure can be read', () => {
    expect(paisaIn(aLine({ amount: '25,000' }))).toBe(2_500_000)
    expect(paisaIn(aLine({ amount: '6057704.50' }))).toBe(605_770_450)
  })

  it('is nothing at all -- and never zero -- when it cannot', () => {
    // The two are different answers about money and `0` is a lie for both: one says he paid nothing, the other that this cannot read what he typed.
    expect(paisaIn(aLine({ amount: '111,111,111,111' }))).toBeNull()
    expect(paisaIn(aLine({ amount: 'abc' }))).toBeNull()
    expect(paisaIn(aLine({ amount: '' }))).toBeNull()
  })

  it('reads the largest figure this keeps and refuses the one above it', () => {
    // The boundary rather than a number picked near it, so a change to what is kept fails here rather than quietly moving what a screen accepts.
    expect(paisaIn(aLine({ amount: String(MAX_PAISA / 100) }))).toBe(MAX_PAISA)
    expect(paisaIn(aLine({ amount: String(MAX_PAISA / 100 + 1) }))).toBeNull()
  })
})

describe('what a sitting comes to', () => {
  it('adds up every line it can read', () => {
    expect(sittingTotalPaisa([aLine({ amount: '25000' }), aLine({ amount: '1,000.50' })])).toEqual({
      paisa: 2_600_050,
      unreadable: 0,
    })
  })

  it('counts what it could not read rather than adding it as nothing', () => {
    // The whole defect in one line: without the count, this total is identical to a sitting where that payment was zero, and the screen has nothing to say about the difference.
    expect(sittingTotalPaisa([aLine({ amount: '25000' }), aLine({ amount: '111,111,111,111' })])).toEqual({
      paisa: 2_500_000,
      unreadable: 1,
    })
  })

  it('says so for each line it could not read, not once for all of them', () => {
    expect(sittingTotalPaisa([aLine({ amount: 'abc' }), aLine({ amount: '999,999,999,999' })])).toEqual({
      paisa: 0,
      unreadable: 2,
    })
  })

  it('comes to nothing on a sitting with nothing in it, which is a real zero', () => {
    expect(sittingTotalPaisa([])).toEqual({ paisa: 0, unreadable: 0 })
  })

  it('holds a line nobody has typed in against nothing', () => {
    // An empty box is a question unanswered, not a figure that could not be read. Counting it as the second opens every day sheet saying it holds something it cannot add.
    expect(sittingTotalPaisa([aLine({ amount: '' })])).toEqual({ paisa: 0, unreadable: 0 })
    expect(sittingTotalPaisa([aLine({ amount: '   ' })])).toEqual({ paisa: 0, unreadable: 0 })
  })
})
