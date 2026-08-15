import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ON_THE_PHONE } from './destinations'

// The sign-in was fixed to the top right corner of one route. On a desk that is where the Sites screen puts its own button, so Nauman opened the app wider than a phone and found the avatar sitting on top of it -- and every screenshot anybody had taken was of a phone, where the wide button is hidden and the round one is at the bottom.

// The overlap was the visible half. The other half is that no other screen had it at all: signing out existed on one screen out of nine, and the tree agreed with itself because nothing asked.

// Read from the repository root, because under jsdom `import.meta.url` is an http address and not a path to anything.
const FRONTEND = 'frontend/src'

function everySourceFile(from: string): Array<string> {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)

    if (entry.isDirectory()) {
      return everySourceFile(path)
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const SOURCE = everySourceFile(FRONTEND).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

const routes = SOURCE.filter((file) => file.path.startsWith(join(FRONTEND, 'routes')))
const holding = (what: RegExp) => SOURCE.filter((file) => what.test(file.text)).map((file) => file.path)

// The two places chrome is allowed to be. Everywhere else is a page drawing over its own content.
const THE_SHELL = join(FRONTEND, 'components', 'shell', 'Shell.tsx')
const ON_A_PHONE = join(FRONTEND, 'components', 'settings', 'YourSignIn.tsx')

describe('where the chrome is allowed to live', () => {
  it('is the shell, and never a route', () => {
    // Swept rather than checked in the one corner it picked: a route pinning it bottom-left instead would be the same defect and would pass a check written about `top-5 right-5`.
    expect(holding(/<UserButton/).sort()).toEqual([ON_A_PHONE, THE_SHELL])
  })

  it('is not pinned over the page by anybody at all', () => {
    // `fixed` inside a route is the shape of it: a page cannot know what the chrome is doing, and the chrome cannot know what a page has put in its corner.
    const pinned = routes.filter((file) => /className="[^"]*\bfixed\b/.test(file.text)).map((file) => file.path)

    expect(pinned).toEqual([])
  })

  it('is reading the routes at all, rather than sweeping an empty list', () => {
    // The floor. A sweep that stopped finding routes would report the same clean answer as a tree with nothing wrong in it.
    expect(routes.length).toBeGreaterThan(5)
    expect(routes.map((file) => file.path)).toContain(join(FRONTEND, 'routes', 'index.tsx'))
  })
})

describe('signing out', () => {
  it('is reachable from every screen, because the shell is on every screen', () => {
    // The half a position-only fix leaves broken. It was on the Sites route and nowhere else, so People, Owed, More and every house screen had no way out at all.
    const shell = SOURCE.find((file) => file.path === THE_SHELL)

    expect(shell?.text).toContain('<UserButton')
    // And the shell is what the root wraps every route in, or the sentence above is about a component nothing renders.
    const root = SOURCE.find((file) => file.path === join(FRONTEND, 'routes', '__root.tsx'))
    expect(root?.text).toContain('<Shell')
  })

  // Deliberately absent: what the bands are is changing. The shell is being replaced with shadcn's Sidebar, the bar along the bottom goes, and navigation on a phone moves to the top corner -- so a guard naming three bands and reading each one out of the shape that carries it would be written to be deleted. A gap somebody knows about is better than a guard that has to be believed and then removed.

  it('is reachable on a phone as a path, which is a different fact from being on the screen', () => {
    // On a desk the sign-in is on the screen. On a phone it is somewhere you get to, and the path has three parts: the bottom bar offers More, More's menu carries a row for it, and the row leads to a route that exists. Any one alone is a guard that passes with a screen nobody can reach.
    expect(ON_THE_PHONE.map((destination) => destination.to)).toContain('/more')

    const menu = SOURCE.find((file) => file.path === join(FRONTEND, 'routes', 'more.index.tsx'))?.text ?? ''
    expect(menu).toContain("to: '/more/your-sign-in'")

    // And the route that row names is a file, or the row is a tab that goes nowhere in a new place.
    expect(SOURCE.map((file) => file.path)).toContain(join(FRONTEND, 'routes', 'more.your-sign-in.tsx'))
    expect(SOURCE.find((file) => file.path === join(FRONTEND, 'routes', 'more.your-sign-in.tsx'))?.text).toContain(
      'YourSignIn'
    )
  })

  it('leads somewhere real from every row of the menu, not only the one this test is about', () => {
    // The same question asked of all five: a row is a promise that a screen exists, and four of them are outside what the test above looks at.
    const menu = SOURCE.find((file) => file.path === join(FRONTEND, 'routes', 'more.index.tsx'))?.text ?? ''
    const named = [...menu.matchAll(/to: '(\/more\/[\w-]+)'/g)].map((found) => found[1])

    // The floor: five rows are drawn, so five are read. A regex that stopped matching would report a clean answer about nothing.
    expect(named.length).toBe(5)

    for (const to of named) {
      const file = join(FRONTEND, 'routes', `more.${to.replace('/more/', '')}.tsx`)
      expect(
        SOURCE.map((one) => one.path),
        `${to} is a row leading nowhere`
      ).toContain(file)
    }
  })
})
