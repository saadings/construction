// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { withoutComments } from './testing/source'

// Four surfaces were being used to say *your finger is on this row*, and none of them is far enough from what it sits on to say anything. Measured by CIEDE2000 against the plane underneath: the row stripe on the page is 0.61, a white card on the page 3.78 and 2.34 after dark, `muted` at half strength on a card 2.47 and 0.32.

// They are surfaces, and a surface is told apart by its border and its own content. A hover has neither -- it is one colour arriving on a row that is otherwise unchanged, so the colour is the whole of the signal.

// `--row-hover` exists for exactly this and is measured for it. The rule is that nothing else does the job, because the way this went wrong was not a decision: four rows were written at four times, each borrowing whatever surface was nearest, and the two that were nearly invisible read in source exactly like the two that were fine.

/** The four a hover may not paint, each one measured under what a hover has to clear. */
const NOT_FAR_ENOUGH = ['muted', 'row-alt', 'panel', 'card']

/** What a hover paints instead, and the only thing it may. */
const THE_ONE = 'row-hover'

// Named, because each is a hover that is not a row: a control with a box of its own is told apart by the box, and one of these is a hover that deliberately paints nothing at all.
const NOT_A_ROW: Array<{ path: string; hover: string; because: string }> = [
  {
    path: 'components/form/Day.tsx',
    hover: 'hover:bg-card',
    because: 'the answer is already a card, so this cancels a ghost button’s fill rather than painting one',
  },
  {
    path: 'components/ui/toggle.tsx',
    hover: 'hover:bg-muted',
    because: 'a choice in a row of choices, which has its own box and a chosen state to be told apart by',
  },
]

/** Every hover a file paints, read off the code and not off the prose about it. */
export function whatItPaintsOnHover(written: string): Array<string> {
  return [...withoutComments(written).matchAll(/hover:bg-([a-z\d/.-]+)/g)].map((found) => `hover:bg-${found[1]}`)
}

/** The tone a hover paints, with any strength dropped: `hover:bg-muted/50` is `muted` painted thinly and is the same surface. */
function whichSurface(hover: string): string {
  return hover.slice('hover:bg-'.length).split('/')[0]
}

describe('a row under a finger', () => {
  const screens = everyScreen()

  it('is painted with the one colour measured for it, on every screen', () => {
    const borrowed = screens.flatMap(({ path, source }) =>
      whatItPaintsOnHover(source)
        .filter((hover) => NOT_FAR_ENOUGH.includes(whichSurface(hover)))
        .filter((hover) => !NOT_A_ROW.some((allowed) => allowed.path === path && allowed.hover === hover))
        .map(
          (hover) => `${path}: ${hover} is a surface, not a hover — bg-${THE_ONE} is the one with a number behind it`
        )
    )

    expect(borrowed).toEqual([])
  })

  it('is asked of the four rows that had borrowed one', () => {
    // The floor, anchored on the files the rule was written about rather than on a count. A sweep that stopped opening them reports exactly what a clean app reports.
    const paints = new Map(screens.map(({ path, source }) => [path, whatItPaintsOnHover(source)]))

    for (const path of [
      // Two names have come off this list and both for the same reason: the row they named stopped being a row. `components/settings/TheMenu.tsx` became four cards, and `components/sites/SitesList.tsx` became a card a house -- his drawing of that screen is a grid, and a card is told apart by its border rather than by a plane arriving under a finger.

      // What they were here to prove -- that the sweep opens the files this rule was written about -- the four below still prove. When the count reaches one, the floor is a floor over nothing and this rule needs a different anchor.
      'components/partners/Positions.tsx',
      'components/partners/AgreeShares.tsx',
      'components/shares/PayOut.tsx',
      'components/ui/table.tsx',
    ]) {
      expect(paints.get(path), `${path} had a hover and the sweep is not opening it`).toContain(`hover:bg-${THE_ONE}`)
    }
  })

  it('names only exceptions that are still there', () => {
    // An exemption outlives what it exempts, and then it is a hole. Each one has to still be a hover somebody wrote.
    for (const { path, hover, because } of NOT_A_ROW) {
      const source = screens.find((screen) => screen.path === path)?.source

      expect(source, `${path} is exempted and is not a screen any more`).toBeDefined()
      expect(
        whatItPaintsOnHover(source ?? ''),
        `${path} no longer paints ${hover}, so "${because}" guards nothing`
      ).toContain(hover)
    }
  })

  it('would notice each of the four, in the shape it had', () => {
    // Verbatim, because the two shapes that were nearly invisible read the same as the two that were fine.
    expect(whatItPaintsOnHover('<li className="hover:bg-muted/60 border-b px-5">')).toEqual(['hover:bg-muted/60'])
    expect(whatItPaintsOnHover('<Link className="hover:bg-panel col-span-2">')).toEqual(['hover:bg-panel'])
    expect(whatItPaintsOnHover('<tr className="hover:bg-muted/50">')).toEqual(['hover:bg-muted/50'])
    expect(whatItPaintsOnHover('<Link className="hover:bg-row-alt -mx-3">')).toEqual(['hover:bg-row-alt'])

    // Half strength is the same surface, and reading the strength as part of the name is how `muted/50` slipped past a search for `muted`.
    expect(whichSurface('hover:bg-muted/50')).toBe('muted')
  })

  it('leaves alone the one it is for, and prose about the ones it is not', () => {
    expect(
      whatItPaintsOnHover('<li className="hover:bg-row-hover">').filter((h) => NOT_FAR_ENOUGH.includes(whichSurface(h)))
    ).toEqual([])
    expect(whatItPaintsOnHover('// this used to be hover:bg-muted/50 and measured 0.32\nconst x = 1')).toEqual([])
  })
})
