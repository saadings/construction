// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Shell } from './Shell'
import { DESTINATIONS, ON_THE_PHONE } from './destinations'

// Clerk's own button refuses to render outside its provider, and what is being tested here is the three shapes of the nav rather than anything Clerk does. Stood in for by a button, so the shell still renders and the tests below are about the shell.

// Where it sits is held by `chrome.test.ts`, reading the source rather than the render, because that is a question about which container it is in and jsdom applies no CSS to answer it with.
vi.mock('@clerk/tanstack-react-start', () => ({
  UserButton: () => <button type="button">Your sign-in</button>,
}))

afterEach(cleanup)

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

// All three shapes are in the page at once and the width decides which one is seen, so a test can only read them apart by their class.
function navsBy(rule: string) {
  return screen.getAllByRole('navigation').filter((nav) => nav.className.includes(rule))
}

describe('the nav, in three shapes', () => {
  it('gives a desk a sidebar, a tablet a top bar and a phone a bar along the bottom', async () => {
    renderAt('/')
    await screen.findByText('The screen itself')

    // Below 640 the sidebar and the top bar are both hidden, and only the bottom bar is left.
    expect(navsBy('lg:flex')).toHaveLength(1)
    expect(navsBy('sm:flex')).toHaveLength(1)
    expect(navsBy('sm:hidden')).toHaveLength(1)
  })

  it('offers the same places to go in every one of them', async () => {
    renderAt('/')
    await screen.findByText('The screen itself')

    for (const nav of navsBy('lg:flex').concat(navsBy('sm:flex'))) {
      for (const destination of DESTINATIONS) {
        expect(within(nav).getByRole('link', { name: new RegExp(destination.label) })).toBeTruthy()
      }
    }
  })

  it('keeps the bar along the bottom to four, because a thumb has no room for five', () => {
    expect(ON_THE_PHONE.length).toBeLessThanOrEqual(4)
    // More is how everything past the fourth is reached, so it has to be one of them.
    expect(ON_THE_PHONE.map((destination) => destination.label)).toContain('More')
  })

  it('marks where you are, and only there', async () => {
    renderAt('/more')
    await screen.findByText('The screen itself')

    const marked = screen
      .getAllByRole('link')
      .filter((link) => link.dataset.status === 'active')
      .map((link) => link.textContent)

    expect(new Set(marked)).toEqual(new Set(['More']))
  })
})

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
})
