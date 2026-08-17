// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { withoutComments } from './testing/source'

// Nine ways out of something already put in, in two treatments and by nobody's decision. Six were underlined and three were plain grey text, and the three that were plain are the ones that remove a row somebody typed: a payment out of a sitting, a payment off a trade, a bill off a house.

// An underline is an affordance and grey text is not, so a control that removes a row was reading as a caption on three screens. `WayOut` is the one of them, and this is what keeps it the one.

/** What a way out says. Every one of them is some shape of taking a thing back out, because that is the only thing this app lets anybody do to a row that has gone in. */

// `Remove` was added after the rename and it is the hole that rename left: the app's word for this control changed, the list of words this reads did not, and a hand-written `<button>Remove</button>` was invisible to the guard written to catch exactly that. Nothing failed, because a rule that cannot see the app reports what a clean app reports.

// The old words stay beside it. Five ways out still say `Take it back`, and a guard that only knows today's vocabulary stops seeing yesterday's the moment somebody writes one.
const WHAT_A_WAY_OUT_SAYS = /^(Remove|Take (out|them off|it back|this line off|it off the list|off the list))$/

/** Where it is written, so the exception below is an exception to something that exists. */
const WHERE_IT_IS_WRITTEN = 'components/form/WayOut.tsx'

// Behind an "are you sure", and a different control from the way out that opens it. These are red because they are the step that actually removes something, and a red first step would put the strongest colour in the app on the thing somebody presses by accident. Named rather than swept up, because the words are nearly the same and the roles are not.
const THE_STEP_AFTER = new Set(['Yes, take it out', 'Never mind', 'Take it off the list', 'Take off the list'])

/** Every plain `<button>` a screen writes whose words are a way out. */
export function aWayOutWrittenByHand(written: string): Array<string> {
  const source = withoutComments(written)
  const found: Array<string> = []

  // Read from the label backwards to the tag that opened it, rather than forwards from the tag: `[^>]*` between a `<button` and its label stops dead at the `>` in an arrow function, which is the trap that once made a sweep of this shape report nothing at all.
  for (const label of source.matchAll(/>\s*([A-Z][^<>{}]*?)\s*</g)) {
    const said = label[1].trim()
    if (!WHAT_A_WAY_OUT_SAYS.test(said) || THE_STEP_AFTER.has(said)) {
      continue
    }

    const opened = [...source.slice(0, label.index).matchAll(/<([A-Za-z][\w.]*)/g)]
    const tag = opened.length === 0 ? '' : opened[opened.length - 1][1]

    if (tag === 'button') {
      found.push(said)
    }
  }

  return found
}

describe('a way out written by hand', () => {
  const screens = everyScreen().filter(({ path }) => path !== WHERE_IT_IS_WRITTEN)

  it('is on none of our screens', () => {
    const byHand = screens.flatMap(({ path, source }) =>
      aWayOutWrittenByHand(source).map((said) => `${path}: "${said}" is a plain button, not a WayOut`)
    )

    expect(byHand).toEqual([])
  })

  it('is asked of the nine screens that each had one', () => {
    // The floor, anchored on the fix rather than on a count. These are the files the rule was written about, and a sweep that stopped opening them would report the same clean result.
    const paths = screens.map(({ path }) => path)

    for (const path of [
      'components/daySheet/DaySheet.tsx',
      'components/moneyIn/ComingIn.tsx',
      'components/partners/AgreeShares.tsx',
      'components/site/ExtraWork.tsx',
      'components/site/SpentByTrade.tsx',
      'components/site/WhoIsOnThisHouse.tsx',
      'components/invites/WhoCanSignIn.tsx',
      'components/shares/PayOut.tsx',
    ]) {
      expect(paths, `${path} is what this rule is about and the sweep is not opening it`).toContain(path)
    }
  })

  it('has each of them reaching for the one that exists', () => {
    // Absence of a hand-written way out is also what a screen with no way out at all looks like. Each of these has to be asking for `WayOut`, not merely be innocent of `<button>`.
    for (const { path, source } of screens) {
      if (!source.includes('<WayOut')) continue

      // Either path to the same file: a screen reaches into `form/`, and a control that lives in `form/` reaches next door. What the rule is about is that nobody writes a second one.
      expect(source, `${path} draws a WayOut and never imports one`).toMatch(/from '(\.\.\/form|\.)\/WayOut'/)
    }

    expect(screens.filter(({ source }) => source.includes('<WayOut')).length).toBeGreaterThan(7)
  })

  it('would notice each of the three that were plain grey text', () => {
    // Verbatim in the shape each of them had, which is the shape that reads as a caption rather than as something to press.
    expect(
      aWayOutWrittenByHand('<button type="button" onClick={() => takeOut(index)} className="text-sm">Take out</button>')
    ).toEqual(['Take out'])
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Take them off</button>')).toEqual(['Take them off'])
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Take this line off</button>')).toEqual([
      'Take this line off',
    ])
  })

  it('leaves the step behind an are-you-sure alone, which is a different control', () => {
    // Red, and rightly: it is the press that removes something. A red first step would put the strongest colour in the app on the thing somebody hits by accident.
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Yes, take it out</button>')).toEqual([])
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Never mind</button>')).toEqual([])
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Take it off the list</button>')).toEqual([])
  })

  it('leaves alone what is already the one, and what is not a way out at all', () => {
    expect(aWayOutWrittenByHand('<WayOut onClick={takeBack}>Take it back</WayOut>')).toEqual([])
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Add a line</button>')).toEqual([])
    expect(aWayOutWrittenByHand('<button type="button" onClick={x}>Put them in</button>')).toEqual([])
    // And the words in a comment about one are not one.
    expect(aWayOutWrittenByHand('// the old <button>Take out</button> was plain grey\nconst x = 1')).toEqual([])

    // The word the rename brought in, in the shape it would arrive in. Verbatim from the plant that proved this rule had gone blind to it.
    expect(
      aWayOutWrittenByHand('<button type="button" onClick={() => setAsking(true)} className="text-sm">Remove</button>')
    ).toEqual(['Remove'])
  })
})
