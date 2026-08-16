// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'

// The quiet line under a name: a day, how it was paid, a cheque number, a note, joined with a middle dot. Four components drew it and two of them cut the cheque number off -- at 390 the payment list rendered `23/07/2026 · Chequ…`, on the screen somebody opens to find out which cheque paid what.

// The bill list had been fixed for exactly this a fortnight earlier, comment and all. The fix stayed in that file and the three beside it kept the old markup, which is what a rule with no instrument is: a paragraph somebody has to remember.

// Asked of the reference rather than of the dot. A cheque number is what may not be cut, and it is the thing that makes this line different from a heading that happens to hold a separator -- `3 put down · Friday` is not this and never was.

/** What the measurement can only see once a line marks itself, which is why this end exists at all: a line written by hand is invisible to it. */
const THE_ONE_LINE = '<SaidUnderneath'

/** Where it is written, because writing it is what that component is for. */
const WHERE_IT_IS_WRITTEN = 'components/shell/Page.tsx'

/** A cheque number, a receipt number, a pay order: the piece of this line that is not recoverable from anywhere else on the screen. */
const A_REFERENCE = /\.reference\b/

/** What this app joins the pieces of that line with, and joins nothing else with. */
const A_MIDDLE_DOT = /·/

/** The four that drew it, named so this cannot pass by having stopped looking at them. */
const THEY_ALL_DREW_ONE = [
  'components/site/SpentByTrade.tsx',
  'components/site/WhoIsOnThisHouse.tsx',
  'components/shares/PayOut.tsx',
  'components/moneyIn/ComingIn.tsx',
]

/** Every screen that draws a reference where somebody reads it, which is every screen this rule is about. */
export function whatShowsAReference(): Array<{ path: string; source: string }> {
  return (
    everyScreen()
      .filter(({ path }) => path.startsWith('components/') && path !== WHERE_IT_IS_WRITTEN)
      .filter(({ source }) => A_REFERENCE.test(source))
      // Read rather than collected. `HowItWasPaid` asks for a cheque number in a box and never draws one in a line, so a rule about lines has nothing to say to it -- and the tell is the separator, because a line under a name is the only place this app joins anything with a dot.

      // Or the component, because a file that has been fixed no longer has a dot in it. Asked on the dot alone, this sweep would shrink by one every time somebody fixed one, and end up watching nothing while reporting a clean nothing.
      .filter(({ source }) => A_MIDDLE_DOT.test(source) || source.includes(THE_ONE_LINE))
  )
}

describe('a line joined by hand', () => {
  it('is on none of the screens that show a cheque number', () => {
    const written = whatShowsAReference()
      .filter(({ source }) => !source.includes(THE_ONE_LINE))
      .map(({ path }) => `${path}: puts a reference on a line it joined itself`)

    expect(written).toEqual([])
  })

  it('is asked of all four that drew one', () => {
    // The floor, anchored on the fix rather than on a count: a sweep that stopped opening these reports the same clean nothing.
    const paths = whatShowsAReference().map(({ path }) => path)

    for (const path of THEY_ALL_DREW_ONE) {
      expect(paths, `${path} is what this rule is about and the sweep is not opening it`).toContain(path)
    }
  })

  it('is written in the one place that is allowed to write it', () => {
    // The other end: a rule about where something lives passes perfectly when it lives nowhere.
    const writes = everyScreen().find(({ path }) => path === WHERE_IT_IS_WRITTEN)

    expect(writes?.source, 'the line is not written where this rule says it is').toMatch(/·/)
    expect(writes?.source).toContain('whitespace-nowrap')
  })

  it('marks the line for the thing that measures it', () => {
    // The attribute is the whole reason a measurement can tell a name that may be cut from a cheque number that may not. Written here as the string the browser sees, because that is what `columns.ts` queries for.
    const writes = everyScreen().find(({ path }) => path === WHERE_IT_IS_WRITTEN)

    expect(writes?.source).toContain("MUST_BE_READ = 'data-must-be-read'")
  })

  it('is what the measurement really asks the page for', () => {
    // Both halves of one instrument, held to each other. The component may rename its attribute and the script would go on measuring nothing, reporting exactly what an app that cuts nothing off reports.

    // Read off the disk, because `everyScreen` reads the app and this half of the instrument is a script beside it.
    const measures = readFileSync(
      join(dirname(new URL(import.meta.url).pathname), '..', '..', 'scripts', 'columns.ts'),
      'utf8'
    )

    expect(measures).toContain('data-must-be-read')
    expect(measures, 'the measurement has no floor, so it reports nothing measured as nothing wrong').toContain(
      'AT_LEAST_THIS_MANY_LINES'
    )
  })
})
