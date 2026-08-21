import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// `Pay` on Payables opens a house's day sheet with the man already chosen, and it says which man in the URL. Two files have to agree on one string and nothing in TypeScript checks it: a route without `validateSearch` accepts any `search` prop, so a misspelt parameter compiles, navigates, opens the right screen and quietly chooses nobody.

// That failure is invisible in a photograph -- the day sheet looks exactly as it should -- and it is the shape that has cost us an evening twice. So it is asked here, from both ends, because either end agrees with itself: a sender checked alone passes when nothing reads it, and a reader checked alone passes when nothing sends it.

// The name is read out of the sender rather than written here. A copy kept in the test is deleted by the same rename it exists to catch, and would agree with whichever half was edited last.
const repoRoot = process.cwd()

const SENDER = 'frontend/src/components/owed/WhatWeOwe.tsx'
const READER = 'frontend/src/routes/sites.$siteId.daybook.tsx'

function read(path: string): string {
  const text = readFileSync(join(repoRoot, path), 'utf8')

  // A file that has moved reads as an empty string to a sweep catching its own error, and an empty string contains no wrong parameter. The read is the first assertion.
  expect(text.length, `${path} is empty or unreadable`).toBeGreaterThan(200)

  return text
}

function whatTheSenderCallsIt(): string {
  const said = /export const PAYING = '([a-zA-Z]+)'/.exec(read(SENDER))

  // A failed match is `null`, and `null?.[1]` is `undefined`, which would sail into `toContain` and pass against any file. The locate is its own assertion.
  expect(said?.[1], `${SENDER} no longer exports PAYING, so nothing here knows what to look for`).toBeTruthy()

  return said?.[1] ?? ''
}

describe('the parameter that carries a man to the screen that pays him', () => {
  it('is sent by the screen that offers to pay him, through the constant rather than a literal', () => {
    expect(whatTheSenderCallsIt()).toBe('paying')
    expect(read(SENDER)).toContain('search={{ [PAYING]: person.personId }}')
  })

  it('is read by the screen it points at, which is the half a photograph cannot check', () => {
    const paying = whatTheSenderCallsIt()

    // Until the route names it, `Pay` navigates and chooses nobody. This test failing is this test working, and it fails on the sender's branch rather than on anybody else's.
    expect(read(READER), `${READER} never mentions "${paying}", so Pay would open it and select nobody`).toContain(
      paying
    )
  })

  it('is a parameter rather than a word that happens to appear in the file', () => {
    // `paying` is ordinary English and could be sitting in a comment. What makes it the parameter is that the route validates its search, which is the only way TanStack hands one over at all.
    expect(read(READER), `${READER} does not validate its search, so nothing receives a parameter`).toMatch(
      /validateSearch/
    )
  })
})
