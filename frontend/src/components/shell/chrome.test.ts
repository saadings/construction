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

  it('is carried at every width, with no band between the three left to nobody', () => {
    // The same failure one width over: in the sidebar only, it is right on a desk and absent on a phone, and every screenshot looks fine again.

    // Asserted as which container each copy is in rather than as a breakpoint class sitting near it. jsdom applies no CSS, so a rendered test can only read that the right word appears -- and `hidden lg:flex` on a wrapper inside something already hidden carries the right word and is visible at no width at all. The containers are the three the nav is already read out of, and each one's own class is what decides the band.
    const shell = SOURCE.find((file) => file.path === THE_SHELL)?.text ?? ''

    const shapes = {
      // A desk. `hidden ... lg:flex` on the nav itself.
      SideBar: shell.slice(shell.indexOf('function SideBar'), shell.indexOf('function TopBar')),
      // Between the two. `hidden ... sm:flex lg:hidden`.
      TopBar: shell.slice(shell.indexOf('function TopBar'), shell.indexOf('function PhoneBar')),
    }

    expect(shapes.SideBar).toContain('lg:flex')
    expect(shapes.SideBar).toContain('<UserButton')
    expect(shapes.TopBar).toContain('sm:flex lg:hidden')
    expect(shapes.TopBar).toContain('<UserButton')

    // And the copy is not wrapped in something that hides it inside a container that shows: one breakpoint decides each band, which is the nav's own.
    for (const [shape, text] of Object.entries(shapes)) {
      const around = text.slice(Math.max(0, text.indexOf('<UserButton') - 220), text.indexOf('<UserButton'))
      expect(around, `the sign-in inside ${shape} is behind a second breakpoint`).not.toMatch(/\bhidden\b|\bsm:|\blg:/)
    }
  })

  it('is reachable on a phone as a path, which is a different fact from being on the screen', () => {
    // On a desk the sign-in is on the screen. On a phone it is somewhere you get to -- the bottom bar has to offer More and More has to render the section -- and either half alone is a guard that passes with a section nobody can reach.
    expect(ON_THE_PHONE.map((destination) => destination.to)).toContain('/more')
    expect(SOURCE.find((file) => file.path === join(FRONTEND, 'routes', 'more.tsx'))?.text).toContain('<YourSignIn')

    // And shown only where the chrome cannot carry it, or a desk would have two of them.
    expect(SOURCE.find((file) => file.path === ON_A_PHONE)?.text).toContain('sm:hidden')
  })

  it('covers every band the app has, rather than two existence checks with a hole between them', () => {
    // Written as the set of widths rather than as a copy per shape: two copies can each carry a correct class and still miss a band nobody named. Tailwind's own edges -- under 640, 640 to 1024, 1024 and up -- and every one of them accounted for by name.
    const covers: Record<string, string> = {
      'under 640, a phone': 'More carries it, and the bottom bar offers More',
      '640 to 1024, a tablet': 'the top bar carries it',
      '1024 and up, a desk': 'the sidebar carries it',
    }

    expect(Object.keys(covers)).toHaveLength(3)

    const shell = SOURCE.find((file) => file.path === THE_SHELL)?.text ?? ''
    // Each band's claim, read back out of what carries it, so a shape that stops carrying it fails the band it was covering rather than a class check somewhere else.
    expect(shell.slice(shell.indexOf('function SideBar'), shell.indexOf('function TopBar'))).toContain('<UserButton')
    expect(shell.slice(shell.indexOf('function TopBar'), shell.indexOf('function PhoneBar'))).toContain('<UserButton')
    expect(ON_THE_PHONE.map((destination) => destination.to)).toContain('/more')
  })

  it('is reading a shell that has all three shapes in it, rather than agreeing with a file that lost one', () => {
    // The floor under every slice above: if `TopBar` were renamed or removed, `indexOf` answers -1, the slice is empty, and an empty string contains nothing -- which reads as a pass.
    const shell = SOURCE.find((file) => file.path === THE_SHELL)?.text ?? ''

    for (const shape of ['function SideBar', 'function TopBar', 'function PhoneBar']) {
      expect(shell, `the shell has lost ${shape}`).toContain(shape)
      expect(shell.indexOf(shape), `${shape} is not where the slices expect it`).toBeGreaterThan(0)
    }

    // In the order the slices assume, or `SideBar` would be sliced against a marker behind it and come back empty.
    expect(shell.indexOf('function SideBar')).toBeLessThan(shell.indexOf('function TopBar'))
    expect(shell.indexOf('function TopBar')).toBeLessThan(shell.indexOf('function PhoneBar'))
  })
})
