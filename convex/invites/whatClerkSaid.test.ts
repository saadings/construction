import { describe, expect, it } from 'vitest'

import { SAY_CLERK, codesIn, whatClerkSaid } from './whatClerkSaid'

// Fixture bodies in, sentences out. No key, no network: the mapping is the whole subject, and a test that needed a key could not run here at all.

/** A refusal shaped the way Clerk shapes one. */
function saying(code: string) {
  return { errors: [{ code, message: 'for developers', long_message: 'also for developers', meta: {} }] }
}

describe('what somebody is told when Clerk refuses', () => {
  it('says the address is spoken for, rather than asking him to try again', () => {
    // The case Nauman hit inviting his first partner. "Try once more in a moment" is the one answer that could never work for it, and it is what he got.
    expect(whatClerkSaid(422, saying('duplicate_record'))).toBe(SAY_CLERK.already)
  })

  it('says it the same way when Clerk spells it as an identifier that already exists', () => {
    // Clerk uses one code when the address collides with an invitation and another when it collides with an account. Both are the same fact to whoever is reading the screen.
    expect(whatClerkSaid(422, saying('form_identifier_exists'))).toBe(SAY_CLERK.already)
  })

  it('says to wait when there have been too many', () => {
    expect(whatClerkSaid(429, undefined)).toBe(SAY_CLERK.tooMany)
  })

  it('says inviting is not switched on when the key is refused, which is nobody using the app', () => {
    // The same sentence a missing key already gives, because it is the same problem and the person reading it can do nothing about either.
    expect(whatClerkSaid(401, undefined)).toBe(SAY_CLERK.notSwitchedOn)
    expect(whatClerkSaid(403, undefined)).toBe(SAY_CLERK.notSwitchedOn)
  })

  it('keeps the generic sentence for anything it has not been taught', () => {
    // Deliberate: a sentence invented for a case nobody has seen is a guess, and a person acts on it.
    expect(whatClerkSaid(500, undefined)).toBe(SAY_CLERK.unknown)
    expect(whatClerkSaid(422, saying('something_nobody_has_seen'))).toBe(SAY_CLERK.unknown)
  })

  it('never puts Clerk’s own words on the screen', () => {
    // Their body names fields and identifiers and quotes the address back. Asserted over every case rather than trusted, because one `?? message` would undo the whole rule quietly.
    const said = [
      whatClerkSaid(422, saying('duplicate_record')),
      whatClerkSaid(429, saying('rate_limit_exceeded')),
      whatClerkSaid(401, saying('authentication_invalid')),
      whatClerkSaid(500, saying('anything_at_all')),
    ]

    for (const sentence of said) {
      expect(sentence).not.toContain('for developers')
      expect(Object.values(SAY_CLERK)).toContain(sentence)
    }
  })

  it('always answers with words, because a screen that is handed anything else says nothing useful', () => {
    // `whatWentWrong` refuses a `data` that is not a non-empty string and falls back to its own line -- so an object here would arrive as the generic sentence this exists to replace.
    for (const status of [401, 403, 404, 422, 429, 500]) {
      const sentence = whatClerkSaid(status, saying('duplicate_record'))

      expect(typeof sentence).toBe('string')
      expect(sentence.length).toBeGreaterThan(0)
    }
  })
})

describe('reading the codes out of a refusal', () => {
  it('finds them where Clerk puts them', () => {
    expect(codesIn(saying('duplicate_record'))).toEqual(['duplicate_record'])
  })

  it('is reading something, rather than returning empty for everything', () => {
    // The floor. Every branch above falls through to the generic sentence when this comes back empty, so a reader that had quietly stopped working would look like an app that had only ever seen unknown failures.
    expect(codesIn({ errors: [{ code: 'a' }, { code: 'b' }] })).toEqual(['a', 'b'])
  })

  it('survives a body that is not the shape it expects, rather than throwing on top of a refusal', () => {
    // A proxy's HTML, an empty 502, a changed schema. Unreadable is unrecognised, and unrecognised keeps the generic sentence.
    expect(codesIn(undefined)).toEqual([])
    expect(codesIn(null)).toEqual([])
    expect(codesIn('a string')).toEqual([])
    expect(codesIn({ errors: 'not an array' })).toEqual([])
    expect(codesIn({ errors: [null, 7, { code: 42 }, { code: 'kept' }] })).toEqual(['kept'])
  })
})
