// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as Money from '~shared/money'

// Two figures on one screen reading the same string are two ways for an assertion to match the wrong one. It has already happened twice here: `CLIENT_PAID − PAID_TO_SUPPLIER` came out equal to `PARTNER_PUT_IN` and a cross-screen test passed for the wrong reason, and on `Owed` the advance held against a supplier renders `58,000` while the kitchen people's outstanding renders `58,000`.

// Both times the figures were distinct as chosen and collided as the app derived them. "One distinctive figure per idea" was written into a fixture file and broken by arithmetic three lines below it, which is what a rule with no instrument does.

// The hard part is that some equalities are meant. A partner who has been paid everything shows `due` and `paid` as the same figure, because that is what fully paid is, and a check that forbids it forbids the picture -- and a guard that fails on a legitimate picture gets switched off.

// So the machine asks rather than a list answering: nudge one figure where it enters the fixture, by one rupee, and render again. Two figures that were equal and moved together are one idea seen twice. Two that were equal and no longer are met by accident.

/** Which `rupeesToPaisa` call to nudge, counted in the order the screen asks for them, or `-1` for the plain render. */
let nudgeAt = -1
let asked = 0

// Mocked at the path the fixtures import, not at the path this file would write. `../../shared/money` and `~shared/money` are two module ids to vitest and only one of them is the one being used -- the first attempt intercepted nothing and reported a screen with no figures on it, which is exactly the clean nothing this file exists to distrust.
vi.mock('~shared/money', async (real) => {
  const actual: typeof Money = await real()

  return {
    ...actual,
    rupeesToPaisa: (input: string | number) => {
      const at = asked
      asked += 1

      // One rupee, which no figure in any fixture is within: enough to move a number, too little to turn a screen into a different screen.
      return actual.rupeesToPaisa(input) + (at === nudgeAt ? 100 : 0)
    },
  }
})

afterEach(cleanup)

/** Every figure on the screen, in the order somebody reads them. Read off the face this app sets figures in, which is the same thing `yarn columns` measures and `width.test.ts` holds every screen to. */
function figuresOnScreen(): Array<string> {
  return [...document.querySelectorAll('[data-testid="the-screen"] .tabular-nums')]
    .map((el) => el.textContent.trim())
    .filter((said) => /\d/.test(said))
}

// The two screens whose subject is a wait say what they prove after eight and twelve seconds. Asked for in a second, they answer with the same nothing they are drawn to show.
async function draw(slug: string, proves: string, nudge: number, provesAfter = 0): Promise<Array<string>> {
  window.location.hash = slug
  asked = 0
  nudgeAt = nudge

  const { Gallery } = await import('./Gallery')
  render(<Gallery />)
  await screen.findAllByText(proves, { exact: false }, { timeout: provesAfter + 4_000 })

  const figures = figuresOnScreen()
  cleanup()

  return figures
}

/** What a figure did under every nudge: `true` where it moved. Two figures with the same answer everywhere are the same idea; two with different answers only looked alike. */
function howEachOneMoves(before: Array<string>, after: Array<Array<string>>): Array<string> {
  return before.map((_, at) => after.map((round) => (round[at] === before[at] ? '.' : 'x')).join(''))
}

/** Figures that read the same and are not the same idea. */
export function whatMeansTwoThings(
  before: Array<string>,
  after: Array<Array<string>>
): Array<{ said: string; ways: number }> {
  const moves = howEachOneMoves(before, after)
  const found: Array<{ said: string; ways: number }> = []

  for (const said of new Set(before)) {
    const where = before.flatMap((one, at) => (one === said ? [at] : []))
    if (where.length < 2) continue

    // Told apart by how they answered the nudges rather than by where they sit. A figure that moves when another does not is a figure the app arrived at separately.
    const ways = new Set(where.map((at) => moves[at])).size
    if (ways > 1) found.push({ said, ways })
  }

  return found
}

describe('what a figure on a gallery screen means', () => {
  it('tells one idea seen twice from two ideas that collided', () => {
    // The instrument first, on figures whose answers are written here rather than measured. `100` moves with the first nudge and `100` moves with the second: same string, different ideas.
    expect(
      whatMeansTwoThings(
        ['100', '100'],
        [
          ['101', '100'],
          ['100', '101'],
        ]
      )
    ).toEqual([{ said: '100', ways: 2 }])

    // And the same string moving together every time is one idea rendered twice, which is what a fully paid partner's `due` and `paid` are.
    expect(whatMeansTwoThings(['100', '100'], [['101', '101']])).toEqual([])
  })

  it('is asked of every screen the gallery shows', async () => {
    const { ON_SHOW } = await import('./screens')
    const said: Array<string> = []
    let figuresSeen = 0

    for (const showing of ON_SHOW) {
      const before = await draw(showing.slug, showing.proves, -1, showing.provesAfter)
      figuresSeen += before.length
      if (before.length < 2) continue

      const rounds: Array<Array<string>> = []
      for (let nudge = 0; nudge < asked; nudge += 1) {
        rounds.push(await draw(showing.slug, showing.proves, nudge, showing.provesAfter))
      }

      for (const collision of whatMeansTwoThings(before, rounds)) {
        said.push(`${showing.slug}: ${collision.said} is ${String(collision.ways)} different ideas`)
      }
    }

    // The floor, set just under what this really counts rather than at a round number nobody measured: 67 figures across the gallery under jsdom, which draws no CSS and so shows fewer than a browser does. A selector that stopped finding figures reports the same clean nothing as a gallery where none of them collide.
    expect(figuresSeen).toBeGreaterThan(50)
    expect(said).toEqual([])
  }, 180_000)
})
