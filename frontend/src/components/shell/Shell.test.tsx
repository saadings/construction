// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Shell } from './Shell'
import { DESTINATIONS, GROUPS } from './destinations'

// Clerk's own button refuses to render outside its provider, and what is being tested here is the nav rather than anything Clerk does. Stood in for by a button, so the shell still renders and the tests below are about the shell.

// Where it sits is held by `chrome.test.ts`, reading the source rather than the render, because that is a question about which container it is in and jsdom applies no CSS to answer it with.
vi.mock('@clerk/tanstack-react-start', () => ({
  UserButton: () => <button type="button">Your sign-in</button>,
}))

afterEach(cleanup)

// Put back however the test left it. Set inside a test and restored at the end, a width outlives any test that fails before its last line -- and every test after it then runs on a phone without saying so.
const AT_A_DESK = window.innerWidth
afterEach(() => {
  window.innerWidth = AT_A_DESK
})

function renderAt(path: string) {
  const root = createRootRoute({ component: () => <Shell>The screen itself</Shell> })
  const children = DESTINATIONS.map((destination) =>
    createRoute({ getParentRoute: () => root, path: destination.to, component: () => null })
  )
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  render(<RouterProvider router={router} />)
}

// Two shapes now rather than one that changes: a rail from 768 up and a strip a phone scrolls, both in the document at once with CSS deciding which is seen. jsdom applies no CSS, so what is read here is that each shape offers every destination -- and which of them is visible at a width is `chrome.test.ts`'s question, read out of the source.

// The sheet is gone with the design, and with it the hamburger, the dialog, and the close-behind-you rule that a sheet needed. A strip that is simply on the page needs none of that, which is the one thing this redesign gives back to the tests as well as to him.
describe('the nav', () => {
  it('offers every place there is to go', async () => {
    renderAt('/')
    await screen.findByText('The screen itself')

    const rail = screen.getByRole('list', { name: 'Sections' })
    for (const destination of DESTINATIONS) {
      expect(within(rail).getByRole('link', { name: new RegExp(destination.label) })).toBeTruthy()
    }
  })

  it('offers every one of them inside the sheet as well, which is the whole of the nav on a phone', async () => {
    // The rail and the sheet draw one component, so this cannot drift -- and it is asked anyway, because "they are the same component" is a claim about the source and this is a claim about what a person can reach.
    const user = userEvent.setup()
    renderAt('/')
    await screen.findByText('The screen itself')

    await user.click(screen.getByRole('button', { name: 'Sections' }))
    const sheet = await screen.findByRole('dialog')

    for (const destination of DESTINATIONS) {
      expect(within(sheet).getByRole('link', { name: new RegExp(destination.label) })).toBeTruthy()
    }
  })

  it('closes the sheet behind whatever was picked, because a phone has only the sheet', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await screen.findByText('The screen itself')

    await user.click(screen.getByRole('button', { name: 'Sections' }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('link', { name: /People/ }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('groups them under the headings he drew, and draws no heading with nothing under it', async () => {
    renderAt('/')
    await screen.findByText('The screen itself')

    for (const group of GROUPS) {
      const under = screen.getByRole('list', { name: group })
      expect(within(under).getAllByRole('link').length, `${group} is a heading over nothing`).toBeGreaterThan(0)
    }
  })

  it('marks where you are, and only there', async () => {
    renderAt('/more')
    await screen.findByText('The screen itself')

    // Both shapes mark it, so the set is the label rather than one entry per shape.
    expect(whatIsMarked()).toEqual(new Set(['More']))
  })

  it('marks More from inside one of its screens, rather than only from the menu', async () => {
    // Every settings screen lives under `/more`, and the mark says which of the four you are inside.
    renderAt('/more/what-for')
    await screen.findByText('The screen itself')

    expect(whatIsMarked()).toEqual(new Set(['More']))
  })

  it('marks Sites only on Sites itself, not on everything under it', async () => {
    // The control for the rule above: `/` is a prefix of every path there is, so it is the one that has to match exactly.
    renderAt('/people')
    await screen.findByText('The screen itself')

    expect(whatIsMarked()).toEqual(new Set(['People']))
  })
})

/** Which destinations are marked as where you are, in either shape. */
function whatIsMarked(): Set<string | null> {
  return new Set(
    screen
      .getAllByRole('link')
      .filter((link) => link.dataset.here !== undefined)
      .map((link) => link.textContent)
  )
}

describe('every place the nav offers to go', () => {
  // The rebase that deleted `sites.new.tsx` left a link to a route that was gone, and 217 tests stayed green because none of them opened it. This is that check, written down.

  // Read from the repository root: under jsdom `import.meta.url` is an http address and not a path to anything.
  const ROUTE_TREE = readFileSync('frontend/src/routeTree.gen.ts', 'utf8')

  it.each(DESTINATIONS)('has a screen behind it: $to', ({ to }) => {
    expect(ROUTE_TREE).toContain(`'${to}'`)
  })

  it('would notice a destination with nothing behind it', () => {
    // The control: the check above is only worth anything if a made-up route fails it.
    expect(ROUTE_TREE).not.toContain("'/nowhere-at-all'")
  })

  // And the converse, which is the half that was missing. The design has four rows the app has no route for yet -- `Daybook`, `Receipts`, `Reports`, `Partners` -- and each is one line in `destinations.ts` the day its route lands. That is exactly the shape of work that gets lost: small, last, and invisible in a diff.

  // So the build stops somebody rather than the handoff being remembered. A screen of its own that nobody can reach from the nav is the same defect as a nav row that reaches nothing, arriving from the other side.

  // Proved by adding a real `routes/partners.tsx` and watching this fail naming `/partners`. It has to be a real route file: `routeTree.gen.ts` is regenerated from the routes directory whenever anything runs, so a line planted into it is gone before the test reads it -- which is a good property of the file and a trap for anybody checking this the obvious way.
  it('offers every screen that is a place of its own, so a new one cannot arrive unreachable', () => {
    // Two properties together, and neither alone is enough. Hanging off the root is what makes a route a section rather than something inside one -- `/more/what-for` is written `path: '/what-for'` with `MoreRoute` as its parent, so a check on the path alone reads it as top level. And one segment is what stops `/sites/new`, which does hang off the root but is a form under Sites.
    const itsOwnPlace = [
      ...ROUTE_TREE.matchAll(/path: '(\/[a-z][a-z-]*|\/)',\s*\n\s*getParentRoute: \(\) => rootRouteImport/g),
    ]
      .map((found) => found[1])
      .filter((path) => path === '/' || !path.slice(1).includes('/'))

    const missing = itsOwnPlace.filter((path) => !DESTINATIONS.some((destination) => destination.to === path))

    expect(missing, 'a screen of its own that the nav does not offer').toEqual([])
  })

  it('is reading real routes, rather than finding none and calling that complete', () => {
    // The floor. A pattern that stopped matching reports the same clean nothing as an app where every screen is in the rail -- which is the failure the sweep above exists to prevent, arriving inside it.
    const found = [
      ...ROUTE_TREE.matchAll(/path: '(\/[a-z][a-z-]*|\/)',\s*\n\s*getParentRoute: \(\) => rootRouteImport/g),
    ].map((one) => one[1])

    // Both ends of the pattern, because it is two things joined and either half breaking leaves the other looking fine: a real section has to be found, and something that is not one has to not be.
    expect(found).toContain('/dashboard')
    expect(found).not.toContain('/what-for')
    expect(found.length).toBeGreaterThan(4)
    expect(found, 'the houses are a section and this is not seeing them').toContain('/')
  })
})
