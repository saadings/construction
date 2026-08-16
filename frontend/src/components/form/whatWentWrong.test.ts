// @vitest-environment node
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { whatWentWrong } from './whatWentWrong'

const IF_IT_SAID_NOTHING = 'That did not go in. Try once more.'

describe('what to say when the server refuses', () => {
  it('says what the server said', () => {
    // The whole point. A refusal is written on the server in the words a person needs, and showing a generic sentence instead throws them away.
    expect(whatWentWrong(new ConvexError('That day is before the house started.'))).toBe(
      'That day is before the house started.'
    )
  })

  it('says the plain sentence when nothing was thrown that carries words', () => {
    // A network that dropped, a bug, a `TypeError`. There is nothing to tell them beyond that it did not happen.
    expect(whatWentWrong(new Error('read of undefined'))).toBe(IF_IT_SAID_NOTHING)
    expect(whatWentWrong('a string nobody wrapped')).toBe(IF_IT_SAID_NOTHING)
    expect(whatWentWrong(undefined)).toBe(IF_IT_SAID_NOTHING)
    expect(whatWentWrong(null)).toBe(IF_IT_SAID_NOTHING)
  })

  it('refuses an `Error` that merely has a `data` on it, which is what a cast could not tell apart', () => {
    // The shape seventeen copies asserted rather than checked, and the shape every test faked. It is not what the client throws, and a check that accepts it is a check that passes on a fixture and not on the app.
    expect(whatWentWrong({ data: 'Give this site a name.' })).toBe(IF_IT_SAID_NOTHING)
    expect(whatWentWrong(Object.assign(new Error('refused'), { data: 'Give this site a name.' }))).toBe(
      IF_IT_SAID_NOTHING
    )
  })

  it('refuses a `data` that is not words, rather than showing what an object stringifies to', () => {
    // `String(thrown.data)` is `[object Object]` here, which five route copies would have put in front of somebody. A refusal nobody can read is worse than the plain sentence, because it looks like the app talking to itself.
    expect(whatWentWrong(new ConvexError({ code: 'nope' }))).toBe(IF_IT_SAID_NOTHING)
    expect(whatWentWrong(new ConvexError(''))).toBe(IF_IT_SAID_NOTHING)
  })

  it('takes its own words when a screen has better ones', () => {
    // Two screens do. An invitation goes out through Clerk rather than into the ledger, and taking something out is not putting something in.
    expect(whatWentWrong(new Error('x'), 'That did not go through. Try once more in a moment.')).toBe(
      'That did not go through. Try once more in a moment.'
    )
    expect(whatWentWrong(new Error('x'), 'That did not come out. Try once more.')).toBe(
      'That did not come out. Try once more.'
    )
    // And the server's words still win over a screen's, because the server knows which rule refused.
    expect(whatWentWrong(new ConvexError('That money is not on this house.'), 'That did not come out.')).toBe(
      'That money is not on this house.'
    )
  })
})
