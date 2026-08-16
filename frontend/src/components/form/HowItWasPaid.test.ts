// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Part } from './HowItWasPaid'
import { howItStands, onePart, whatEachPartIsWorth } from './HowItWasPaid'

// Nauman: "Sometimes we pay by cash and cheques so we need the ability to split between each."

// The arithmetic he watches while he types. It is not a refusal at the end -- he is standing on a site with a cheque book, and a form that lets him fill the whole thing in and then says no is a form he stops using.

function part(over: Partial<Part> = {}): Part {
  return { ...onePart(), ...over }
}

describe('what each way of paying is worth', () => {
  it('is the whole figure, when there is only one way', () => {
    // The screen asks for the amount once. A box asking him to type a figure that is already on the screen is a box he has to agree with himself in.
    expect(whatEachPartIsWorth('300,000', [part()])).toEqual(['300,000'])
  })

  it('is what he typed against each, once there is more than one', () => {
    expect(whatEachPartIsWorth('300,000', [part({ amount: '200,000' }), part({ amount: '100,000' })])).toEqual([
      '200,000',
      '100,000',
    ])
  })
})

describe('how a split stands against the figure above it', () => {
  it('says nothing at all while it is one payment', () => {
    // Nothing to reconcile: the one way takes all of it by definition, and a sentence about that is a sentence about nothing.
    expect(howItStands('300,000', [part()])).toBeNull()
  })

  it('says what is left to split', () => {
    expect(howItStands('300,000', [part({ amount: '200,000' }), part({ amount: '40,000' })])).toEqual({
      said: 'still to split',
      paisa: 6_000_000,
    })
  })

  it('says when it is over, which "still to split" cannot express', () => {
    // The likelier slip: he enters both parts and then corrects one upward. Without this the sentence disappears at exactly the moment the figures stop agreeing.
    expect(howItStands('300,000', [part({ amount: '200,000' }), part({ amount: '150,000' })])).toEqual({
      said: 'more than the amount above',
      paisa: 5_000_000,
    })
  })

  it('says it is all of it, rather than falling silent when it comes out right', () => {
    // A finished split and one nobody has started must not look the same. Saying nothing is what they would both do.
    expect(howItStands('300,000', [part({ amount: '200,000' }), part({ amount: '100,000' })])).toEqual({
      said: 'all of it',
    })
  })

  it('counts a part it cannot read rather than adding it as nothing', () => {
    // The same rule as the running total above it: `111,111,111,111` is not a figure worth zero, and a split has more places for that to hide.
    expect(howItStands('300,000', [part({ amount: '111,111,111,111' }), part({ amount: '100,000' })])).toEqual({
      said: 'unreadable',
      parts: 1,
    })
  })

  it('holds a part nobody has typed in against nothing, and still says what is left', () => {
    // An empty box is a question unanswered, not a figure that could not be read: opening a second way to pay must not immediately call it unreadable.
    expect(howItStands('300,000', [part({ amount: '200,000' }), part({ amount: '' })])).toEqual({
      said: 'still to split',
      paisa: 10_000_000,
    })
  })

  it('says nothing when the figure above it cannot be read either', () => {
    // There is nothing to measure the parts against, and the amount's own box is already saying so. Two sentences about one mistake reads as two mistakes.
    expect(howItStands('abc', [part({ amount: '200,000' }), part({ amount: '100,000' })])).toBeNull()
  })
})
