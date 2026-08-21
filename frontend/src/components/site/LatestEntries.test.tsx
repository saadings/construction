// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatHasBeenPut } from './LatestEntries'
import { LatestEntries } from './LatestEntries'

afterEach(cleanup)

const PUT_DOWN: WhatHasBeenPut = {
  standing: 47,
  rows: [
    { _id: 'p1', day: '2026-07-23', amountPaisa: 500_000_00, category: 'Civil labour', paidToName: 'The mason' },
    { _id: 'p2', day: '2026-07-11', amountPaisa: 120_000_00, category: 'Cement', paidToName: 'The cement shop' },
  ],
}

// The card carries a way through, so it needs somewhere to point.
async function renderWith(what: WhatHasBeenPut | null | undefined) {
  const root = createRootRoute({ component: () => <LatestEntries siteId="s1" what={what} /> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)

  // A router mounts on its own schedule. Read before it has, and every assertion that looks for something fails and every assertion that looks for nothing passes.
  if (what !== null) {
    await screen.findByRole('status').catch(() => screen.findByRole('heading', { name: 'Latest entries' }))
  }
}

describe('the latest entries on a house', () => {
  it('says the day, what it was for, who was paid and how much', async () => {
    await renderWith(PUT_DOWN)

    expect(await screen.findByText('Civil labour')).toBeTruthy()
    expect(screen.getByText('The mason')).toBeTruthy()
    expect(screen.getByText('500,000')).toBeTruthy()
    // The day as he writes it, everywhere.
    expect(screen.getByText('23/07/2026')).toBeTruthy()
  })

  it('says what it is showing five of, rather than implying the house has five', async () => {
    await renderWith(PUT_DOWN)

    // A card showing two of forty-seven and saying nothing says the house has two.
    expect(await screen.findByText('2 of 47 payments on this site')).toBeTruthy()
  })

  it('offers the sheet where a payment can actually be corrected, rather than a second way to remove one', async () => {
    await renderWith(PUT_DOWN)

    const through = await screen.findByRole('link', { name: 'Open daybook' })
    expect(through.getAttribute('href')).toBe('/sites/s1/daybook')

    // Every other list of payments in this app carries the control that takes one out. This one is a glance -- two places to remove the same row is how two people remove it twice.
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  })

  it('says a house has had nothing put down on it yet', async () => {
    await renderWith({ rows: [], standing: 0 })

    expect(await screen.findByText('Nothing has been put down on this house yet')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
    // And the way through is still there, because it is where the first one goes in.
    expect(screen.getByRole('link', { name: 'Open daybook' })).toBeTruthy()
  })

  it('keeps the two unknowns apart', async () => {
    await renderWith(undefined)
    expect(await screen.findByRole('status', { name: 'Getting the latest payments' })).toBeTruthy()

    cleanup()

    // A refusal draws nothing: the page around it has already said why, and a card saying it again says it twice.
    await renderWith(null)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Latest entries')).toBeNull()
  })
})
