import { describe, expect, it } from 'vitest'

import { everythingItSays, whatKind, worthSaying } from '../scripts/whatItCallsThings'

// Nauman: "You have used so lame language for the whole app, e.g. an Add button is named Put on list, a delete is Take it off... I asked you make the app simple not dumb."

// The sweep that answers that is only worth what it can see, and the first version could not see a single-word label at all: one filter meant to drop types and paths dropped `Balance`, `Paid`, `Due` and `Cheque` with them.

// Survivable in a list. Fatal in anything built on it, because **every word the rename produces is one word** -- a sweep blind to those passes an app relabelled correctly and passes one where `How much` has come back as `Sum`, and reports the same clean nothing either way.

const EVERYTHING = everythingItSays()
const SAID = [...EVERYTHING.keys()]

describe('what this app says', () => {
  it('can see a label that is one word, which is what most of them are becoming', () => {
    const oneWord = SAID.filter((said) => !/\s/.test(said))

    // The floor, and it exists because this blindness shipped once. A number chosen rather than measured is the next thing to go quiet, so it sits under what is really there -- 43 the day it was written.
    expect(oneWord.length).toBeGreaterThan(20)

    for (const word of ['Balance', 'Paid', 'Cheque', 'Transfer']) {
      expect(oneWord, `${word} is a label this app draws and the sweep cannot see it`).toContain(word)
    }
  })

  it('can see prose that wraps across lines, which is what the sentences are', () => {
    // A sentence is written across four lines of source and drawn as one. A pattern that stopped at a newline could see none of the paragraphs this app explains itself with -- which is the half of the vocabulary that is staying.
    expect(SAID).toContain(
      'A house put away comes off the list. What was spent on it is still there, and every payment still points at it.'
    )
  })

  it('is read from the whole app rather than one corner of it', () => {
    // The floor for the sweep itself: a reader that stopped finding files reports a vocabulary of nothing, and nothing is what a finished rename looks like.
    expect(SAID.length).toBeGreaterThan(200)

    const everywhere = new Set([...EVERYTHING.values()].flatMap((one) => [...one.drawn]))
    expect([...everywhere].some((path) => path.startsWith('convex/'))).toBe(true)
    expect([...everywhere].some((path) => path.startsWith('shared/'))).toBe(true)
  })

  it('knows code from something said to somebody', () => {
    expect(worthSaying('Balance')).toBe(true)
    expect(worthSaying('Paid in advance')).toBe(true)

    // A path, an identifier, a file and an address are code whatever their length.
    expect(worthSaying('components/form/Field.tsx')).toBe(false)
    expect(worthSaying('lumpSum')).toBe(false)
    expect(worthSaying('them@example.com')).toBe(false)
    expect(worthSaying('BUILDING')).toBe(false)
  })

  it('tells a label from a sentence, and says when it cannot', () => {
    // The rule bites on labels. `Amount` instead of `How much` is a label getting shorter; `Offline` instead of a sentence about a payment is a promise deleted.
    expect(whatKind('How much')).toBe('label')
    expect(whatKind('This has not gone in yet — it will as soon as the phone has signal.')).toBe('sentence')
  })
})

// The two sentences a table quoted as one, welded from the opening of the first and the ending of the second. They are nearly the same words and the opposite promise.

// A reading fills itself in because a subscription is open. A send does not: the queue is held in memory, so closing the app is the one thing that loses it -- which is why one of these ends by telling him to keep the screen open and the other by telling him it will arrive on its own.

// Written down here rather than remembered, because the merge happened inside a section whose whole argument was that nothing gets paraphrased.
describe('the two silences', () => {
  it('says of a send that it has not gone in, and that the screen must stay open', () => {
    const sending = SAID.find((said) => said.startsWith('This has not gone in yet'))

    expect(sending, 'the sentence a send shows is not in the app any more').toBeDefined()
    expect(sending).toContain('as soon as the phone has signal')
    expect(sending, 'a send does not fill itself in -- the queue is in memory').not.toContain('fill in')
  })

  it('says of a reading that it has not come through, and that it fills itself in', () => {
    const reading = SAID.find((said) => said.startsWith('This has not come through yet'))

    expect(reading, 'the sentence a reading shows is not in the app any more').toBeDefined()
    expect(reading).toContain('It will fill in as soon as it has')
    expect(reading, 'a reading is not something he can lose by closing the app').not.toContain('Keep this screen open')
  })
})
