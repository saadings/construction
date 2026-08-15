// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

// A Convex read answers `undefined` while it is in flight and `null` when it refuses. Collapsing them shows a refusal as a spinner, and the person waits for something that has already happened.

// Nauman waited on "Getting your sites…" forever for exactly this. Waiting could never have worked: the answer had arrived and said no.
const SOURCE = join(dirname(new URL(import.meta.url).pathname), '..')

function screenFiles(dir: string): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return screenFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

/** The readings a screen takes off Convex, which are the only ones that answer `undefined` and `null` for different reasons. */
function readingsIn(source: string): Array<string> {
  return [...source.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*useQuery\s*\(/g)].map((found) => found[1])
}

/** Every place a screen answers a reading for it: `people ?? null` says "no" on behalf of a read that has not spoken. */
export function collapsesWaitingIntoAValue(source: string): Array<string> {
  const readings = readingsIn(source)
  if (readings.length === 0) return []

  // `null` is the refusal itself, and `[]`, `{}` and `0` are worse: they say the ledger is empty when nobody has been asked yet.
  const answered = new RegExp(
    `\\b(${readings.join('|')})\\s*(\\?\\?|\\|\\|)\\s*(null|\\[\\s*\\]|\\{\\s*\\}|0)(?![\\w$])`,
    'g'
  )

  return [...source.matchAll(answered)].map((found) => `${found[1]} ${found[2]} ${found[3]}`)
}

/** Every place a screen treats "still waiting" and "the answer is no" as one condition. */
export function collapsesWaitingIntoRefused(source: string): Array<string> {
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
  const screens = screenFiles(SOURCE).map((path) => ({ path, source: readFileSync(path, 'utf8') }))

  it('never shows a refusal as though it were still coming', () => {
    const collapsed = screens.flatMap(({ path, source }) =>
      collapsesWaitingIntoRefused(source).map((condition) => `${path.split('/src/')[1]}: ${condition}`)
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
      collapsesWaitingIntoAValue(source).map((where) => `${path.split('/src/')[1]}: ${where}`)
    )

    expect(answered).toEqual([])
  })

  it('catches the second spelling of it, which the condition above cannot see', () => {
    // Verbatim from the People screen, which shipped the same permanent spinner a day after the first one was found. A condition matcher looks for `if`, and this one never wrote an `if`.
    const shipped = 'const people = useQuery(api.people.queries.list, {})\npeople={people ?? null}'
    expect(collapsesWaitingIntoAValue(shipped)).toEqual(['people ?? null'])

    // Emptiness is the worse half: it says the ledger holds nothing rather than that nobody has answered.
    const asEmpty = 'const sites = useQuery(api.sites.queries.all, {})\nsites.map(...) // sites ?? []'
    expect(collapsesWaitingIntoAValue(asEmpty)).toEqual(['sites ?? []'])
    expect(collapsesWaitingIntoAValue('const t = useQuery(a, {})\nt || 0')).toEqual(['t || 0'])
  })

  it('leaves alone everything that is not a reading', () => {
    // A field that may be absent is not a read in flight, and coalescing one is how a table shows a dash instead of a gap.
    const fields = 'const people = useQuery(api.people.queries.list, {})\n{person.phone ?? null}\n{site.note ?? []}'
    expect(collapsesWaitingIntoAValue(fields)).toEqual([])
    // And a screen that reads nothing has nothing to answer for.
    expect(collapsesWaitingIntoAValue('const total = paid ?? 0')).toEqual([])
  })
})
