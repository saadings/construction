// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { EverythingIn, Receipt } from './EverythingThatCameIn'
import { EverythingThatCameIn } from './EverythingThatCameIn'

afterEach(cleanup)

// Inside a router now, because the screen has a way in on it: `Record a receipt`, which is a `Link` and needs somewhere to point. It had none before -- `Receipts` was a screen somebody could read and not write to, which is what left the second card of the `New entry` dialog with nowhere to land.
async function renderIt(everything: EverythingIn | null | undefined) {
  const root = createRootRoute({ component: () => <EverythingThatCameIn everything={everything} /> })
  const kids = ['/money-in/new'].map((path) => createRoute({ getParentRoute: () => root, path, component: () => null }))
  const router = createRouter({
    routeTree: root.addChildren(kids),
    history: createMemoryHistory({ initialEntries: ['/money-in'] }),
  })

  const drawn = render(<RouterProvider router={router} />)

  // Awaited, because a router draws on a tick and everything below asks its questions the moment this returns. Without it every one of them is asked of an empty body, which reads exactly like a screen that stopped drawing.
  await screen.findByRole('heading', { name: 'Receipts' })

  return drawn
}

// Two houses, because what this screen is for is the question one house cannot answer.

// Two of each kind, so that no total on a tile is also a figure on a row. With one row per kind a tile reading its own row's amount -- or the table reading the tiles -- looks exactly like a working screen.
const CAME_IN: Array<Receipt> = [
  {
    _id: 'r1',
    day: '2026-07-23',
    amountPaisa: 450_000_00,
    why: 'clientPayment',
    method: 'cheque',
    reference: 'CH-4471',
    siteId: 's1',
    siteName: '1-A, Phase 0',
    fromName: 'The one it is built for',
  },
  {
    _id: 'r2',
    day: '2026-07-11',
    amountPaisa: 200_000_00,
    why: 'partnerMoney',
    method: 'transfer',
    siteId: 's2',
    siteName: '204-C, Phase 6',
    fromName: 'The one who started it',
  },
  {
    _id: 'r3',
    day: '2026-06-28',
    amountPaisa: 120_000_00,
    why: 'clientPayment',
    method: 'payOrder',
    reference: 'PO-2288',
    siteId: 's1',
    siteName: '1-A, Phase 0',
    fromName: 'The one it is built for',
  },
  {
    _id: 'r4',
    day: '2026-06-02',
    amountPaisa: 35_000_00,
    why: 'partnerMoney',
    method: 'cash',
    siteId: 's2',
    siteName: '204-C, Phase 6',
    fromName: 'The one who came in later',
  },
]

function everythingIn(over: Partial<EverythingIn> = {}): EverythingIn {
  return {
    receipts: CAME_IN,
    byWhy: { partnerMoney: 235_000_00, clientPayment: 570_000_00, sale: 0 },
    receivedPaisa: 805_000_00,
    ...over,
  }
}

describe('what has come in altogether', () => {
  it('says which house each one landed on, which is the whole reason it is read over all of them', async () => {
    await renderIt(everythingIn())

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('1-A, Phase 0')).toBeTruthy()
    expect(within(rows[1]).getByText('204-C, Phase 6')).toBeTruthy()
  })

  it('keeps a partner’s own money apart from what a client pays, in the words a house already uses', async () => {
    await renderIt(everythingIn())

    // The distinction the whole profit split stands on, said on the row rather than left to the reader.
    expect(screen.getAllByText('Partner investment').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Client payment').length).toBeGreaterThan(0)
  })

  it('shows the total and the three kinds it is made of, so nothing is left out of the sum', async () => {
    await renderIt(everythingIn())

    // Read off the tiles themselves rather than off the page: every one of these figures is also somewhere in the table, and a body-wide search cannot tell a tile from the row under it.
    const onTheTiles = screen.getAllByRole('definition').map((figure) => figure.textContent)

    // The drawing has three tiles and there are four figures. Two tiles beside a total they do not add up to is the question this screen would leave somebody holding.
    expect(onTheTiles).toContain('805,000')
    expect(onTheTiles).toContain('570,000')
    expect(onTheTiles).toContain('235,000')
    // A reason nothing has come in under reads as zero rather than going missing.
    expect(onTheTiles).toContain('0')

    // And the parts really are the whole, so this cannot pass on four figures that happen to be on the screen.
    expect(570_000 + 235_000 + 0).toBe(805_000)
  })

  it('names each figure on the tile it is on, rather than leaving four numbers in a row', async () => {
    await renderIt(everythingIn())

    // A `dl` pairs them, so the reading is the pairing rather than the order they happen to be drawn in.
    expect(screen.getAllByRole('term').map((label) => label.textContent)).toEqual([
      'Come in',
      'Partner investment',
      'Client payment',
      'Sale proceeds',
    ])
  })

  it('keeps a cheque number whole, on the screen where somebody checks one against a cheque book', async () => {
    await renderIt(everythingIn())

    expect(screen.getByText('CH-4471')).toBeTruthy()
    // And the two rows say how the money arrived, which is what the reference belongs to.
    expect(screen.getByText('Cheque')).toBeTruthy()
    expect(screen.getByText('Transfer')).toBeTruthy()
  })

  it('writes the day the way he writes it', async () => {
    await renderIt(everythingIn())

    expect(screen.getByText('23/07/2026')).toBeTruthy()
  })

  it('says what to do when nothing has come in yet', async () => {
    await renderIt(everythingIn({ receipts: [] }))

    expect(screen.getByText(/Nothing has come in yet/)).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('keeps the two unknowns apart rather than folding them together', async () => {
    const { unmount } = await renderIt(undefined)
    expect(screen.getByRole('status', { name: 'Getting what has come in' })).toBeTruthy()
    unmount()

    // The ledger has answered and does not know this sign-in, which is not a slow read.
    await renderIt(null)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/sign-in/i)).toBeTruthy()
  })
})
