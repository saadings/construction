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
})
