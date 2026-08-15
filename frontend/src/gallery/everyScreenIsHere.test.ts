// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { everyScreen } from '../testing/screens'

// A gallery of eleven screens looks exactly like a gallery of twelve. Nothing on the page says one is missing, nobody counts the buttons, and the screen that fell out is the one nobody then looks at -- which is the whole of what the gallery was built to stop.

// So the list is checked against the app rather than against itself, from both ends: every screen a route draws whole is on show, and everything on show is a screen that exists.

const ROOT = process.cwd()

const SHOWN = readFileSync(join(ROOT, 'frontend/src/gallery/screens.tsx'), 'utf8')

// Read from the routes rather than kept as a second list here. A list of screens written beside the gallery would drift with it, and both would agree.
const ROUTES = everyScreen().filter((screen) => screen.path.startsWith('routes/'))

// What a route draws whole: it imports one screen out of `components/` and renders it. `sites.$siteId.index.tsx` and `sites.new.tsx` do not -- they compose a `<Page>` inline out of several parts -- and those are the two the gallery cannot reach without extracting their rendering, which is a bigger change than this one.
const DRAWN_WHOLE = /import { (\w+) } from '\.\.\/components\/[\w./$-]+'/g

function whatTheRoutesDraw(): Array<string> {
  const drawn = new Set<string>()

  for (const route of ROUTES) {
    for (const [, name] of route.source.matchAll(DRAWN_WHOLE)) {
      // Rendered by the route rather than merely imported: `Skeleton`, `Page` and `Figure` are pieces a route builds with, and a piece is not a screen.
      if (route.source.includes(`<${name}`) && !PIECES.has(name)) {
        drawn.add(name)
      }
    }
  }

  return [...drawn].sort()
}

/** Imported by a route and rendered by it, but a part of a screen rather than one. */
const PIECES = new Set([
  'Page',
  'Figure',
  'Skeleton',
  'WhileWaiting',
  'SkeletonLines',
  'SitesListWaiting',
  'TheCountWaiting',
  'NotKnownHere',
  'Shell',
  'WayIn',
  'Positions',
  'WhatHasComeIn',
  'Billing',
  'SpentByTrade',
  'WhoIsOnThisHouse',
  'ChangeTheHouse',
  'HouseDetails',
])

/** Drawn by a route, but not from the gallery: `WayIn` and the shell are the sign-in itself, and Clerk will not render outside its own provider. */
const NOT_WITHOUT_A_SIGN_IN = new Set(['Shell', 'WayIn'])

describe('the gallery', () => {
  it('shows every screen a route draws whole', () => {
    const missing = whatTheRoutesDraw().filter(
      (name) => !NOT_WITHOUT_A_SIGN_IN.has(name) && !SHOWN.includes(`import { ${name} }`)
    )

    expect(missing).toEqual([])
  })

  it('is reading the routes, rather than finding no screens and calling that complete', () => {
    // The floor, and the shape that has gone quiet in this repository more than once: a sweep that stopped matching reports exactly what an app with nothing missing reports.
    const drawn = whatTheRoutesDraw()

    expect(drawn.length).toBeGreaterThan(8)
    expect(drawn).toContain('DaySheet')
    expect(drawn).toContain('AgreeShares')
  })

  it('shows nothing that is not a screen this app has', () => {
    // The other end. A gallery can also drift by keeping a screen that was deleted, which draws fine from fixtures and is a picture of something nobody can reach.
    const files = new Set(everyScreen().map((screen) => screen.path))

    for (const [, from] of SHOWN.matchAll(/from '\.\.\/(components\/[\w./$-]+)'/g)) {
      expect(files.has(`${from}.tsx`), `the gallery draws ${from}, which this app does not have`).toBe(true)
    }
  })

  it('is reading the gallery, rather than an empty string', () => {
    // Every check above passes perfectly against a file that has lost its contents, in the direction that matters: `missing` would be everything, but the last one would find nothing to object to.
    expect(SHOWN.length).toBeGreaterThan(2000)
    expect(SHOWN).toContain('export const ON_SHOW')
  })

  it('says on the page that none of it is the ledger', () => {
    // Not in a README. A demo full of plausible rows outlives the demo: the risk is not that anybody is fooled today, it is that in six weeks a screen here looks fine and nobody notices the real one stopped working.
    const page = readFileSync(join(ROOT, 'frontend/src/gallery/Gallery.tsx'), 'utf8')

    expect(page).toContain('Nothing here is the ledger.')
    expect(page).toMatch(/invented/)
  })

  it('keeps the app out of it, so a gallery cannot become a way into the ledger', () => {
    // No Convex, no Clerk, no generated api. The screens take props; anything here that could reach a deployment would make this a second front door to the real thing.
    const gallery = everyScreen().filter((screen) => screen.path.startsWith('gallery/'))

    expect(gallery.length).toBeGreaterThan(2)
    for (const file of gallery) {
      expect(file.source, `${file.path} reaches for the backend`).not.toMatch(/convex\/_generated|@clerk|convex\/react/)
    }
  })
})
