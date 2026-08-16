import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

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

// The one place chrome is allowed to be. Everywhere else is a page drawing over its own content.

// It was two until the sidebar landed: a phone had no chrome to carry it, so a screen under More did. The sheet carries it now, so the same footer answers every width and the screen that stood in for it is gone.
const THE_SHELL = join(FRONTEND, 'components', 'shell', 'Shell.tsx')

// The nav came out of the shell so something could measure it: the shell holds Clerk, Clerk needs its own provider, and the gallery has none -- so everything in that file was exempt from being looked at, and every nav row inside it stayed 32px on a phone until Nauman found them with a thumb. The footer is in this file now, and the shell hands it what goes in.
const THE_NAV = join(FRONTEND, 'components', 'shell', 'TheNav.tsx')

// The way in was exempt for the same reason the nav was, and the exemption was the same size as the screen rather than the size of its reason: one wrapper around one button. It takes that wrapper as a prop now, so the gallery draws it -- and what the app hands it is what the rule below is about.
const THE_WAY_IN = join(FRONTEND, 'components', 'shell', 'WayIn.tsx')

describe('where the chrome is allowed to live', () => {
  it('is the shell, and never a route', () => {
    // Swept rather than checked in the one corner it picked: a route pinning it bottom-left instead would be the same defect and would pass a check written about `top-5 right-5`.
    expect(holding(/<UserButton/)).toEqual([THE_SHELL])
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

  it('is in the footer, which is the one part of the nav every width shows', () => {
    // The whole of it: the column has a footer and the sheet is the same component, so there is no second answer for a phone and nothing to keep in step.

    // Asked across the join now that the nav is its own file, and asked in both halves rather than one. Either half alone passes while signing out is unreachable: a footer holding `{footer}` says nothing about what is passed to it, and a shell passing a `<UserButton` says nothing about where it lands.
    const nav = SOURCE.find((file) => file.path === THE_NAV)?.text ?? ''
    const footer = nav.slice(nav.indexOf('<SidebarFooter'), nav.indexOf('</SidebarFooter>'))

    // The locate is the assertion: `indexOf` answers -1 for a footer that is gone, and a slice from -1 is not empty -- it is the tail of the file, which contains everything.
    expect(nav).toContain('<SidebarFooter')
    expect(nav.indexOf('<SidebarFooter')).toBeGreaterThan(0)
    expect(nav.indexOf('</SidebarFooter>')).toBeGreaterThan(nav.indexOf('<SidebarFooter'))

    expect(footer).toContain('{footer}')

    // And the other end: the shell is what puts Clerk's control into it.
    const shell = SOURCE.find((file) => file.path === THE_SHELL)?.text ?? ''

    expect(shell).toMatch(/<TheNav[\s\S]*footer={<UserButton/)
  })

  it('is opened by Clerk on the way in, and not by a stand-in', () => {
    // The same shape as the footer above and the same risk. `WayIn` takes what opens the sign-in as a prop so the gallery can draw the screen at last, and the gallery passes something that opens nothing -- which is right there and catastrophic in the app.

    // TypeScript stops the prop being dropped, because it is required. It does not stop the app passing something that is not Clerk's, and that is the case this exists for.

    // Both halves again, and either alone passes while signing in is unreachable: a root passing `opens={TheSignIn}` says nothing about the screen using it, and a screen rendering `<Opens>` says nothing about what it was given.
    const root = SOURCE.find((file) => file.path === join(FRONTEND, 'routes', '__root.tsx'))?.text ?? ''
    const wayIn = SOURCE.find((file) => file.path === THE_WAY_IN)?.text ?? ''

    expect(root).toMatch(/<WayIn[\s\S]*opens={/)
    expect(root).toContain('SignInButton mode="modal"')
    expect(wayIn).toContain('<Opens>')
  })

  it('has nothing left over from when a phone had no chrome to carry it', () => {
    // A screen and a menu row that existed only because the bar along the bottom held four and had four. Left behind they would be a second way to one thing, drifting from the first.
    expect(SOURCE.map((file) => file.path)).not.toContain(join(FRONTEND, 'routes', 'more.your-sign-in.tsx'))
    expect(SOURCE.map((file) => file.path)).not.toContain(join(FRONTEND, 'components', 'settings', 'YourSignIn.tsx'))
    expect(SOURCE.find((file) => file.path === join(FRONTEND, 'routes', 'more.index.tsx'))?.text).not.toContain(
      'your-sign-in'
    )
  })

  it('leads somewhere real from every row of the menu, not only the one this test is about', () => {
    // The same question asked of all five: a row is a promise that a screen exists, and four of them are outside what the test above looks at.
    const menu = SOURCE.find((file) => file.path === join(FRONTEND, 'routes', 'more.index.tsx'))?.text ?? ''
    const named = [...menu.matchAll(/to: '(\/more\/[\w-]+)'/g)].map((found) => found[1])

    // The floor: four rows are drawn, so four are read. A regex that stopped matching would report a clean answer about nothing.
    expect(named.length).toBe(4)

    for (const to of named) {
      const file = join(FRONTEND, 'routes', `more.${to.replace('/more/', '')}.tsx`)
      expect(
        SOURCE.map((one) => one.path),
        `${to} is a row leading nowhere`
      ).toContain(file)
    }
  })
})
