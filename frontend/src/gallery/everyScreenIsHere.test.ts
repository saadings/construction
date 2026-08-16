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
  // Reached through `AgreeShares`'s `beneath`, so the `Page` around it is that screen's. Found by the rule below rather than by anybody noticing: it was the third component a route imports and renders without one, and the only one of the three that was right.
  'PayOut',
])

/** Drawn by a route, but not from the gallery: `WayIn` and the shell are the sign-in itself, and Clerk will not render outside its own provider. */
const NOT_WITHOUT_A_SIGN_IN = new Set(['Shell', 'WayIn'])

/** The one screen that draws its own layout rather than sitting in a `Page`, and is right to: a day sheet is a sticky header over a form, so its padding is inside the header and inside the form rather than around both. */
const ITS_OWN_LAYOUT = new Set(['DaySheet'])

// The question above is asked of routes, and the app does not compose itself out of routes alone. `AgreeAContract` is drawn by `Billing`, which is drawn by a route -- so it sat one level below what anything asked about, and two changes went through it without a picture ever being taken. `ChangeTheContract`, `Positions`, `WhoIsOnThisHouse` and `HouseDetails` were in the same place: six screens, and the sweep that exists to stop exactly this reported clean on all of them.

// So the same question, asked of what the app actually draws rather than of where it is mounted: anything holding a form or a table a person reads, wherever it hangs.
const A_SCREEN = /<(Form|Page|Field|Choices|table)\b/

/** Every component that draws something somebody reads and fills in. */
function everythingWithAScreenInIt(): Array<string> {
  return everyScreen()
    .filter(({ path }) => path.startsWith('components/'))
    .filter(({ path }) => !path.startsWith('components/ui/') && !path.startsWith('components/form/'))
    .filter(({ source }) => A_SCREEN.test(source))
    .map(({ path }) => path.split('/').pop()?.replace('.tsx', '') ?? '')
}

/** Everything the gallery draws, and everything those draw in turn: a picture of a screen is a picture of its parts. */
function everythingAPictureReaches(): Set<string> {
  const written = new Map(
    everyScreen()
      .filter(({ path }) => path.startsWith('components/'))
      .map(({ path, source }) => [path.split('/').pop()?.replace('.tsx', '') ?? '', source])
  )

  const reached = new Set<string>()
  const asking = [...SHOWN.matchAll(/<([A-Z]\w+)/g)].map((found) => found[1]).filter((name) => written.has(name))

  while (asking.length > 0) {
    const name = asking.pop()
    if (name === undefined || reached.has(name)) continue
    reached.add(name)

    for (const drawn of (written.get(name) ?? '').matchAll(/<([A-Z]\w+)/g)) {
      if (!reached.has(drawn[1]) && written.has(drawn[1])) asking.push(drawn[1])
    }
  }

  return reached
}

/** Screens no picture can reach, each with the reason. A name here is a screen nobody will ever see photographed, so the reason has to be about the screen rather than about the effort. */
const NO_PICTURE_CAN_REACH: Record<string, string> = {
  Billing:
    'reads Convex itself -- `useQuery` for the contract, the stages and the extra work -- and the gallery must hold nothing that could reach a deployment. What it draws is on show one piece at a time.',
}

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

  it('draws every one of them inside a `Page`, which is where the margins are', () => {
    // `Page` carries the padding, and its own comment says why: so six screens cannot each invent their own. A screen that never renders one invents nothing and gets none — `WhoCanSignIn` and `BankAccounts` each wrote an `<h2>` and a bare `<section>`, and sat flush against the left edge of a phone at x=0 while every other screen began at 20.

    // Asked of the screens rather than of the routes, because a `Page` put in the route would leave the gallery drawing the same component without one — and then the thing measured would not be the thing shipped.
    const files = new Map(everyScreen().map((screen) => [screen.path, screen.source]))

    const bare = whatTheRoutesDraw()
      .filter((name) => !NOT_WITHOUT_A_SIGN_IN.has(name) && !ITS_OWN_LAYOUT.has(name))
      .map((name) => [...files].find(([path]) => path.endsWith(`/${name}.tsx`)))
      .filter((found) => found !== undefined)
      .filter(([, source]) => !source.includes('<Page'))
      .map(([path]) => path)

    expect(bare).toEqual([])
  })

  it('has nothing named as drawing its own layout that is not a screen any more', () => {
    // An exemption outlives what it was written for, and a stale one silently excuses whatever takes that path next.
    const drawn = new Set(whatTheRoutesDraw())

    for (const name of ITS_OWN_LAYOUT) {
      expect(drawn, `${name} is named as drawing its own layout and no route draws it`).toContain(name)
    }
  })

  it('shows nothing that is not a screen this app has', () => {
    // The other end. A gallery can also drift by keeping a screen that was deleted, which draws fine from fixtures and is a picture of something nobody can reach.
    const files = new Set(everyScreen().map((screen) => screen.path))

    for (const [, from] of SHOWN.matchAll(/from '\.\.\/(components\/[\w./$-]+)'/g)) {
      expect(files.has(`${from}.tsx`), `the gallery draws ${from}, which this app does not have`).toBe(true)
    }
  })

  it('draws every screen in this app, wherever it hangs', () => {
    // The rule the routes question could not ask. Six screens were below it, and the guard that exists to stop that reported a clean sweep on every one.
    const unphotographed = everythingWithAScreenInIt().filter(
      (name) =>
        !everythingAPictureReaches().has(name) && !(name in NO_PICTURE_CAN_REACH) && !NOT_WITHOUT_A_SIGN_IN.has(name)
    )

    expect(unphotographed).toEqual([])
  })

  it('names nothing as unreachable that a picture could now reach', () => {
    // The other end. An exemption that has stopped being true reads exactly like one still needed -- and this one is held to its own reason rather than to its name.
    for (const [name, why] of Object.entries(NO_PICTURE_CAN_REACH)) {
      const screen = everyScreen().find(({ path }) => path.endsWith(`/${name}.tsx`))

      expect(screen, `${name} is exempted and is not a screen this app has`).toBeDefined()
      expect(why).toContain('Convex')
      expect(screen?.source, `${name} is exempted for reaching Convex and does not`).toMatch(/useQuery|useMutation/)
    }
  })

  it('is reading a tree that really has screens in it', () => {
    // The floor for both. A reader that stopped finding screens reports every one of nothing photographed.
    expect(everythingWithAScreenInIt().length).toBeGreaterThan(20)
    expect(everythingAPictureReaches().size).toBeGreaterThan(20)
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
