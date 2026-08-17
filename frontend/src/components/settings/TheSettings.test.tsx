// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatIsOnIt } from './TheSettings'
import { TheSettings } from './TheSettings'

afterEach(cleanup)

const TRADES = [
  { _id: 't1', name: 'Civil labour', countsAsBuildingCost: true },
  { _id: 't2', name: 'Bricks', countsAsBuildingCost: true },
  { _id: 't3', name: 'Supervision charges', countsAsBuildingCost: false },
]

const ACCOUNTS = [
  { _id: 'b1', label: 'Bank 4021' },
  { _id: 'b2', label: 'Bank 7788' },
]

function whatIsOnIt(over: Partial<WhatIsOnIt> = {}): WhatIsOnIt {
  return { trades: TRADES, accounts: ACCOUNTS, looksLike: 'Auto', ...over }
}

// The cards carry ways through, so they need somewhere to point.

// Awaited rather than rendered, and that is not a formality: a router mounts on its own schedule, so a synchronous read finds an empty body -- which fails every assertion that looks for something and **passes** every assertion that looks for nothing. The sign-out check below is exactly that shape, and it passed against a blank page before this was awaited.
async function renderWith(what: WhatIsOnIt) {
  const root = createRootRoute({ component: () => <TheSettings what={what} /> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)

  // The heading is drawn from nothing that is read, so it is there in every state this screen has.
  await screen.findByRole('heading', { name: 'Categories' })
}

describe('the lists the rest of the app picks from', () => {
  it('puts each list on the screen rather than behind it', async () => {
    await renderWith(whatIsOnIt())

    // The question that had somebody opening four screens is *is the one I am looking for on it*, and a count cannot answer that.
    expect(screen.getByText('Civil labour')).toBeTruthy()
    expect(screen.getByText('Bricks')).toBeTruthy()
    expect(screen.getByText('Bank 4021')).toBeTruthy()
    expect(screen.getByText('Bank 7788')).toBeTruthy()
    expect(screen.getByText('Auto')).toBeTruthy()
  })

  it('keeps a way through to the screen that changes each one', async () => {
    await renderWith(whatIsOnIt())

    const goes = screen.getAllByRole('link', { name: 'Open' }).map((link) => link.getAttribute('href'))
    expect(goes).toEqual(['/more/what-for', '/more/which-account', '/more/who-can-sign-in', '/more/how-it-looks'])
  })

  it('says which trades are not part of building cost, and only where one is', async () => {
    await renderWith(whatIsOnIt())

    // The reason the flag exists: supervision charges are real money and are not what the house cost to build.
    expect(screen.getByText(/not part of building cost/)).toBeTruthy()
    expect(screen.getByText('Supervision charges')).toBeTruthy()

    cleanup()

    // And with every trade a building cost, the sentence is not there at all -- a card explaining an exception that does not exist is a card teaching somebody a rule they will look for and not find.
    await renderWith(whatIsOnIt({ trades: TRADES.filter((trade) => trade.countsAsBuildingCost) }))
    expect(screen.queryByText(/not part of building cost/)).toBeNull()
  })

  it('counts the tail rather than cutting it', async () => {
    const many = Array.from({ length: 14 }, (_, at) => ({
      _id: `t${String(at)}`,
      name: `Trade ${String(at)}`,
      countsAsBuildingCost: true,
    }))

    await renderWith(whatIsOnIt({ trades: many }))

    // Ten named and four counted. A card showing ten of fourteen and saying nothing says the list is ten long.
    expect(screen.getByText('Trade 9')).toBeTruthy()
    expect(screen.queryByText('Trade 10')).toBeNull()
    expect(screen.getByText('and 4 more')).toBeTruthy()

    // And the count beside the heading is the whole list, not what fitted.
    expect(within(screen.getByRole('heading', { name: 'Categories' }).parentElement!).getByText('14')).toBeTruthy()
  })

  it('keeps the two unknowns apart on each card that reads something', async () => {
    await renderWith(whatIsOnIt({ trades: undefined, accounts: undefined }))

    expect(screen.getByRole('status', { name: 'Getting the trades' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Getting the accounts' })).toBeTruthy()

    cleanup()

    // A refusal is not a wait. The screen behind the card says why, and a card that pulses forever says nothing at all.
    await renderWith(whatIsOnIt({ trades: null, accounts: null }))
    expect(screen.queryByRole('status')).toBeNull()

    // And the cards are all still there with their ways through, rather than the screen having quietly emptied.
    expect(screen.getAllByRole('link', { name: 'Open' })).toHaveLength(4)
  })

  it('says what to do when a list is empty, which is not the same as one still coming', async () => {
    await renderWith(whatIsOnIt({ trades: [], accounts: [] }))

    expect(screen.getByText(/Nothing on the list yet/)).toBeTruthy()
    expect(screen.getByText(/No account yet/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('offers no second way to sign out, because the corner already has one', async () => {
    await renderWith(whatIsOnIt())

    // The screen is really on the page first. A `not.toMatch` against a body that never rendered is the cleanest pass in this file and means nothing at all -- which is what it did before the render was awaited.
    expect(screen.getByText('Who can sign in')).toBeTruthy()

    // The account control moved into the phone header. Two places to sign out is worse than either.
    expect(document.body.textContent).not.toMatch(/sign out/i)
  })
})
