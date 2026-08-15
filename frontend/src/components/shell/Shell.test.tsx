// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Shell } from './Shell'
import { DESTINATIONS } from './destinations'

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

// One list, rendered once. jsdom reports the desktop shape because `useIsMobile` reads a width it has no window to measure -- so what is read here is the nav's contents, and where each shape puts it is `chrome.test.ts`'s question, read out of the source.
describe('the nav', () => {
  it('offers every place there is to go', async () => {
    renderAt('/')
    await screen.findByText('The screen itself')

    const nav = screen.getByRole('list', { name: 'Sections' })
    for (const destination of DESTINATIONS) {
      expect(within(nav).getByRole('link', { name: new RegExp(destination.label) })).toBeTruthy()
    }
  })

  it('offers a way to open it where there is no column to see', async () => {
    // Below 768 the column is not rendered at all and this is the only way to the nav. It used to be a bar along the bottom under a thumb; Nauman chose the corner knowing that, and the sheet is what he opens standing on a site.
    renderAt('/')
    await screen.findByText('The screen itself')

    expect(screen.getByRole('button', { name: 'Toggle Sidebar' })).toBeTruthy()
  })

  it('closes the sheet behind whatever was picked, because a phone has only the sheet', async () => {
    // The one thing jsdom can answer about a phone: the sidebar branches on width in JavaScript, so setting the width picks the branch even though no CSS applies. A sheet you have to dismiss after picking something is two actions where there was one, and the second is the one you forget while holding a cheque book.
    window.innerWidth = 390
    renderAt('/')
    await screen.findByText('The screen itself')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }))
    const sheet = await screen.findByRole('dialog')

    fireEvent.click(within(sheet).getByRole('link', { name: /People/ }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('marks where you are, and only there', async () => {
    renderAt('/more')
    await screen.findByText('The screen itself')

    const marked = screen
      .getAllByRole('link')
      .filter((link) => link.dataset.active === 'true')
      .map((link) => link.textContent)

    expect(new Set(marked)).toEqual(new Set(['More']))
  })

  it('marks More from inside one of its screens, rather than only from the menu', async () => {
    // Every settings screen lives under `/more`, and the mark says which of the four you are inside.
    renderAt('/more/what-for')
    await screen.findByText('The screen itself')

    const marked = screen
      .getAllByRole('link')
      .filter((link) => link.dataset.active === 'true')
      .map((link) => link.textContent)

    expect(new Set(marked)).toEqual(new Set(['More']))
  })

  it('marks Sites only on Sites itself, not on everything under it', async () => {
    // The control for the rule above: `/` is a prefix of every path there is, so it is the one that has to match exactly.
    renderAt('/people')
    await screen.findByText('The screen itself')

    const marked = screen
      .getAllByRole('link')
      .filter((link) => link.dataset.active === 'true')
      .map((link) => link.textContent)

    expect(new Set(marked)).toEqual(new Set(['People']))
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
