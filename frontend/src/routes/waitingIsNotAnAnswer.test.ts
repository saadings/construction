// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../testing/screens'
import { withoutComments } from '../testing/source'

// A Convex read answers `undefined` while it is in flight and `null` when it refuses. Collapsing them shows a refusal as a spinner, and the person waits for something that has already happened.

// Nauman waited on "Getting your sites…" forever for exactly this. Waiting could never have worked: the answer had arrived and said no.

/** The readings a screen takes off Convex, which are the only ones that answer `undefined` and `null` for different reasons. */
function readingsIn(source: string): Array<string> {
  return [...source.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*useQuery\s*\(/g)].map((found) => found[1])
}

// What is reached off a reading before it is answered for. `what?.positions ?? []` is the same defect as `what ?? []` and this could not see it: it looked for the name and then immediately for the `??`, so anything between the two hid it. const found that one by hand, two lines above one this did catch -- and a guard with a hole in it is worse than no guard, because it is believed.
const REACHED_INTO = String.raw`((?:\s*\??\.\s*\w+)*)`

/** Every place a screen answers a reading for it: `people ?? null` says "no" on behalf of a read that has not spoken. */
export function collapsesWaitingIntoAValue(written: string): Array<string> {
  const source = withoutComments(written)
  const readings = readingsIn(source)
  if (readings.length === 0) return []

  // `null` is the refusal itself, and `[]`, `{}` and `0` are worse: they say the ledger is empty when nobody has been asked yet.
  const answered = new RegExp(
    `\\b(${readings.join('|')})${REACHED_INTO}\\s*(\\?\\?|\\|\\|)\\s*(null|\\[\\s*\\]|\\{\\s*\\}|0)(?![\\w$])`,
    'g'
  )

  return (
    [...source.matchAll(answered)]
      // A plain `.` off a reading is not this: the compiler refuses `what.positions` while `what` may still be undefined, so a screen that writes it has already answered the waiting somewhere above. `?.` is the tell -- it is written by somebody who knows the thing may not be there, which is the case this is about.
      .filter((found) => found[2] === '' || found[2].includes('?.'))
      .map((found) => `${found[1]}${found[2].replace(/\s+/g, '')} ${found[3]} ${found[4]}`)
  )
}

/** Every place a screen treats "still waiting" and "the answer is no" as one condition. */
export function collapsesWaitingIntoRefused(written: string): Array<string> {
  const source = withoutComments(written)
  const both = /if\s*\(([^)]*===\s*undefined[^)]*===\s*null[^)]*|[^)]*===\s*null[^)]*===\s*undefined[^)]*)\)/g

  return (
    [...source.matchAll(both)]
      .map((found) => found[1].replace(/\s+/g, ' ').trim())
      // Two different readings, one waiting and one refused, is not a collapse: `a === undefined || b === null` asks two questions about two things.
      .filter((condition) => {
        const named = [...condition.matchAll(/(\w+)\s*===\s*(undefined|null)/g)]
        return named.some(([, name]) => named.filter(([, other]) => other === name).length > 1)
      })
  )
}

describe('what a screen does with an answer it has not got', () => {
  // Tests of screens are left out, where they were swept before. A fixture demonstrating the bug is not a screen shipping it -- this file is full of them, and every plant below would read as a violation of the rule it proves.
  const screens = everyScreen()

  it('never shows a refusal as though it were still coming', () => {
    const collapsed = screens.flatMap(({ path, source }) =>
      collapsesWaitingIntoRefused(source).map((condition) => `${path}: ${condition}`)
    )

    expect(collapsed).toEqual([])
  })

  it('is read over screens that really do wait on something', () => {
    // The floor. A reader that stopped finding conditions would report a clean sweep, which is what a clean sweep looks like.
    const waiting = screens.filter(({ source }) => source.includes('=== undefined'))

    expect(waiting.length).toBeGreaterThan(2)
  })

  it('catches the one that was shipped, and the same mistake written the other way round', () => {
    // Verbatim from the screen Nauman was stuck on.
    expect(collapsesWaitingIntoRefused('if (sites === undefined || sites === null) {')).toHaveLength(1)
    expect(collapsesWaitingIntoRefused('if (sites === null || sites === undefined) {')).toHaveLength(1)
  })

  it('leaves two readings asked about separately alone', () => {
    // `a === undefined || b === null` is two questions about two things, which is correct and common.
    expect(collapsesWaitingIntoRefused('if (site === undefined || totals === null) {')).toEqual([])
    expect(collapsesWaitingIntoRefused('if (stages === undefined || extra === undefined) {')).toEqual([])
    expect(collapsesWaitingIntoRefused('if (stages === null || extra === null) {')).toEqual([])
  })

  it('never answers a reading on its behalf', () => {
    const answered = screens.flatMap(({ path, source }) =>
      collapsesWaitingIntoAValue(source).map((where) => `${path}: ${where}`)
    )

    expect(answered).toEqual([])
  })

  it('catches the second spelling of it, which the condition above cannot see', () => {
    // Verbatim from the People screen, which shipped the same permanent spinner a day after the first one was found. A condition matcher looks for `if`, and this one never wrote an `if`.
    const shipped = 'const people = useQuery(api.people.queries.list, {})\npeople={people ?? null}'
    expect(collapsesWaitingIntoAValue(shipped)).toEqual(['people ?? null'])

    // Emptiness is the worse half: it says the ledger holds nothing rather than that nobody has answered. Written as code rather than in a comment, because this control used to pass by matching prose, which is the same defect it was written to catch.
    const asEmpty = 'const sites = useQuery(api.sites.queries.all, {})\nconst rows = (sites ?? []).map(one)'
    expect(collapsesWaitingIntoAValue(asEmpty)).toEqual(['sites ?? []'])
    expect(collapsesWaitingIntoAValue('const t = useQuery(a, {})\nt || 0')).toEqual(['t || 0'])
  })

  it('catches it reached into as well as bare, which is the hole it had', () => {
    // Both spellings, in the shape they were really in: const found `what?.positions ?? []` by hand, two lines above an `accounts ?? []` this did catch. The first is a screen saying "nobody is on this house" while the read is still in flight.
    const reachedInto =
      'const what = useQuery(api.partners.queries.onThisHouse, {})\nconst positions = what?.positions ?? []'
    expect(collapsesWaitingIntoAValue(reachedInto)).toEqual(['what?.positions ?? []'])

    const bare = 'const accounts = useQuery(api.bankAccounts.queries.list, {})\nconst rows = accounts ?? []'
    expect(collapsesWaitingIntoAValue(bare)).toEqual(['accounts ?? []'])

    // Both at once, because they really were two lines apart and the one it could see is what made the other look absent.
    expect(collapsesWaitingIntoAValue(`${reachedInto}\n${bare}`)).toEqual(['what?.positions ?? []', 'accounts ?? []'])

    // Further down the chain, and answered with the emptiness rather than the refusal.
    expect(collapsesWaitingIntoAValue('const it = useQuery(a, {})\nconst n = it?.owed?.total ?? 0')).toEqual([
      'it?.owed?.total ?? 0',
    ])
  })

  it('leaves alone a field read off an answer that has already arrived', () => {
    // A plain `.` is not this. The compiler refuses `what.positions` while `what` may still be undefined, so a screen that writes it has answered the waiting somewhere above -- and `?.` is what somebody writes who knows the thing may not be there.
    expect(collapsesWaitingIntoAValue('const site = useQuery(a, {})\nconst note = site.note ?? null')).toEqual([])
    expect(collapsesWaitingIntoAValue('const site = useQuery(a, {})\nconst n = site.owed.total ?? 0')).toEqual([])
  })

  it('reads the code and not what is written about it', () => {
    // Both of these were found in screens that had gone to the trouble of saying why they were not doing it. A guard that reads prose as code teaches people to stop writing the prose.
    const explained =
      'const people = useQuery(api.people.queries.list, {})\n// `people ?? []` here would say somebody is gone when the read had not come back.\nconst who = people.find(one)'
    expect(collapsesWaitingIntoAValue(explained)).toEqual([])
    expect(
      collapsesWaitingIntoRefused(
        '// if (sites === undefined || sites === null) was the bug\nif (sites === undefined) {'
      )
    ).toEqual([])

    // And the code underneath a comment about it is still read.
    const both =
      'const people = useQuery(a, {})\n// `people ?? []` would be wrong here.\nconst who = (people ?? []).find(one)'
    expect(collapsesWaitingIntoAValue(both)).toEqual(['people ?? []'])
  })

  it('leaves alone everything that is not a reading', () => {
    // A field that may be absent is not a read in flight, and coalescing one is how a table shows a dash instead of a gap.
    const fields = 'const people = useQuery(api.people.queries.list, {})\n{person.phone ?? null}\n{site.note ?? []}'
    expect(collapsesWaitingIntoAValue(fields)).toEqual([])
    // And a screen that reads nothing has nothing to answer for.
    expect(collapsesWaitingIntoAValue('const total = paid ?? 0')).toEqual([])
  })
})
