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

  it('is reachable in one tap at every width, and lives in exactly one place at each', () => {
    // It moved, and the reason is the shape of the requirement rather than the shape of the layout. Signing out is not a thing somebody strolls to: it is what they reach for on a shared phone or in the wrong account, and a person in that state looks for their own face rather than for a menu. Behind a hamburger it was two taps and no label.

    // So the corner of the header on a phone, the foot of the rail on a desk, and not both anywhere -- two places to sign out is worse than either one.
    const shell = SOURCE.find((file) => file.path === THE_SHELL)?.text ?? ''
    const nav = SOURCE.find((file) => file.path === THE_NAV)?.text ?? ''

    // On a desk it is handed to the rail, and the rail draws it in the row that carries the 44px. Both halves, because either alone passes while signing out is unreachable: a row holding `{footer}` says nothing about what is passed to it, and a shell passing a `<UserButton` says nothing about where it lands.
    expect(shell).toMatch(/<TheNav footer={signOut}/)

    const at = nav.indexOf('min-h-11 items-center border-t')
    expect(at, 'the row the sign-out sits in is gone').toBeGreaterThan(0)
    expect(nav.slice(at, at + 200)).toContain('{footer}')

    // On a phone it is in the header, one tap, on every screen. The locate is the assertion again: a header that has stopped drawing it answers -1 here rather than passing quietly.
    const corner = shell.indexOf('ml-auto flex size-11')
    expect(corner, 'the account is not in the corner of the phone header').toBeGreaterThan(0)
    expect(shell.slice(corner, corner + 220)).toContain('<UserButton')

    // And the sheet does not draw it. `TheNavOnAPhone` renders the rail with no footer at all, so there is one answer per width rather than two.
    expect(nav).toContain('<TheNav />')
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

describe('the way out of the nav on a phone', () => {
  const THE_SHEET = join(FRONTEND, 'components', 'ui', 'sheet.tsx')

  it('is a control a thumb can hit, and not the size of the icon in it', () => {
    // Found in a picture of main rather than by anything here. shadcn's own line positions this button and never sizes it, so it collapsed to its 16px icon -- in the one navigation a phone has, on the control that takes focus the moment the sheet opens. It read as an empty brass square, because the focus ring was larger than the button it was ringing.

    // A string and not a measurement, which is the honest description of this test. The sweep that measures what a thumb can hit asks `[data-nav-row]`, and this button is inside our sheet, is shadcn's markup, and wears none of our attributes -- so it sits in the gap between the two definitions the selector has had. Widening that sweep is the real instrument and is its own piece of work; this holds the line until it lands, and it is written here rather than in the vendored file because the next `shadcn add sheet` overwrites the file and not this.
    const sheet = SOURCE.find((file) => file.path === THE_SHEET)?.text ?? ''

    // Matched on the control rather than on its name. `SheetPrimitive.Close` is in this file three times and the first is a type annotation -- `React.ComponentProps<typeof SheetPrimitive.Close>` -- so an `indexOf` lands on a line that draws nothing and reads the wrong 400 characters. It failed, which is luck: had the annotation happened to sit above a `size-11` this would have passed while the button stayed 16px.

    // Which is the -1 problem with the sign flipped. A locator that matches more than one thing has a wrong-one that reads exactly like the right one, and neither the type nor the assertion can tell them apart. So the anchor is the shape only the drawn button has: a class, and the icon inside it.
    const drawn = /<SheetPrimitive\.Close\s+className="([^"]*)"\s*>\s*<XIcon/.exec(sheet)

    expect(drawn, 'the sheet draws no close button around an icon at all').not.toBeNull()
    expect(drawn?.[1] ?? '', 'the close button is positioned and never sized').toContain('size-11')
  })
})

// The way in is the same shape as the footer and needs the same question asked of it. Clerk will not render outside its own provider and the gallery holds nothing that could reach a deployment, so what opens the sign-in is handed to `WayIn` as a prop and the gallery hands it a stand-in.

// Which means the picture is of the real button in a fake wrapper. TypeScript stops the prop being dropped -- it is required -- and stops nothing about what is passed, so the app could hand it the same do-nothing wrapper the gallery does and the screen would photograph perfectly while signing in did nothing at all.
describe('signing in', () => {
  const THE_WAY_IN = join(FRONTEND, 'components', 'shell', 'WayIn.tsx')
  const THE_ROOT = join(FRONTEND, 'routes', '__root.tsx')

  it('is opened by Clerk’s own control, followed by name rather than assumed', () => {
    const root = SOURCE.find((file) => file.path === THE_ROOT)?.text ?? ''

    // Which wrapper the root hands over, read off the call rather than guessed at: a test naming `TheSignIn` passes the day somebody renames it and stops meaning anything the day somebody replaces it.
    const handed = /<WayIn\s+opens=\{(\w+)\}/.exec(root)

    // The locate is the assertion. `null` here is a root that no longer draws the way in at all, which every check below would otherwise read as nothing to complain about.
    expect(handed, 'the root does not hand `WayIn` anything to open the sign-in with').not.toBeNull()

    const named = handed?.[1] ?? ''
    const wrapper = root.slice(root.indexOf(`function ${named}(`))

    expect(root, `${named} is handed to the way in and is not defined in the root`).toContain(`function ${named}(`)
    expect(wrapper.slice(0, 400), `${named} does not open Clerk’s sign-in`).toContain('<SignInButton mode="modal">')
    expect(wrapper.slice(0, 400), `${named} does not put the button inside it`).toContain('{children}')
  })

  it('is where the button lands, which is the other half', () => {
    // A root passing Clerk's own says nothing about the screen drawing it: `WayIn` could stop rendering the wrapper entirely and there would be a sign-in button on the screen that opens nothing.
    const wayIn = SOURCE.find((file) => file.path === THE_WAY_IN)?.text ?? ''

    expect(wayIn, 'the way in draws no sign-in at all').toContain('Sign in')
    expect(wayIn, 'the way in does not put its button inside what it was handed').toMatch(
      /<Opens>[\s\S]*<Button[\s\S]*<\/Opens>/
    )
  })

  it('is the one screen Clerk is allowed to be drawn on', () => {
    // The sweep the footer has: `<SignInButton` anywhere else is a second way in, drifting from the first, and the gallery must hold none at all.
    expect(holding(/<SignInButton/)).toEqual([THE_ROOT])
  })
})
