// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { Standing, WhatIsOwed } from './WhatWeOwe'
import { WhatWeOwe } from './WhatWeOwe'

afterEach(cleanup)

// The steel supplier out of the workbooks: one man, two houses, one balance.
const STEEL: Standing = {
  personId: 'p1',
  name: 'A steel supplier',
  billedPaisa: 1_000_000_00,
  paidPaisa: 250_000_00,
  outstandingPaisa: 750_000_00,
  onHouses: [
    { siteId: 's2', name: '2-B, Phase 0', billedPaisa: 400_000_00, paidPaisa: 0, outstandingPaisa: 400_000_00 },
    {
      siteId: 's1',
      name: '1-A, Phase 0',
      billedPaisa: 600_000_00,
      paidPaisa: 250_000_00,
      outstandingPaisa: 350_000_00,
    },
  ],
}

// And a man holding an advance, which is a real position and the reason nothing here is netted.
const MASON: Standing = {
  personId: 'p2',
  name: 'A mason',
  billedPaisa: 100_000_00,
  paidPaisa: 250_000_00,
  outstandingPaisa: -150_000_00,
  onHouses: [
    {
      siteId: 's1',
      name: '1-A, Phase 0',
      billedPaisa: 100_000_00,
      paidPaisa: 250_000_00,
      outstandingPaisa: -150_000_00,
    },
  ],
}

function whatIsOwed(over: Partial<WhatIsOwed> = {}): WhatIsOwed {
  return { everyone: [STEEL, MASON], payablePaisa: 750_000_00, advancedPaisa: 150_000_00, ...over }
}

// The rows carry links to a person and to a house, so they need somewhere to point.
function renderWith(owed: WhatIsOwed | null | undefined) {
  const root = createRootRoute({ component: () => <WhatWeOwe owed={owed} /> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)
}

// The machine showing through: a row called a `record`, an amount in `paisa`, a reading that arrived as `null` rendered as a word.

// `outstanding` was on this list and is not any more, and that is a decision rather than a slip. It was banned as jargon; Nauman has since chosen it himself -- `Standing` and `Owed right now` both become `Outstanding` -- and a bookkeeping word he says out loud is the opposite of what this rule is about.
const THE_MACHINE_SHOWING = /entity|paisa|query|database|null|undefined/i

describe('what is owed altogether', () => {
  it('keeps what is owed and what is held apart, and never nets them', async () => {
    // A single figure would read 600,000 here and hide that one man is owed 750,000 today. The workbooks keep MARKET PAYABLES and TOTAL RECEIVABLE on separate lines for the same reason.
    renderWith(whatIsOwed())
    await screen.findAllByRole('listitem')

    // Both figures are up, each under its own words. 750,000 is also the steel supplier's own standing, so it is there twice on purpose.
    expect(screen.getAllByText('750,000')).toHaveLength(2)
    expect(screen.getByText('Owed to them')).toBeTruthy()
    expect(screen.getByText('Paid in advance')).toBeTruthy()
    expect(screen.getByText('150,000')).toBeTruthy()
    // And the netted figure appears nowhere, because it is the one nobody can act on.
    expect(document.body.textContent).not.toContain('600,000')
  })

  it('gives each person one balance, however many houses it came from', async () => {
    renderWith(whatIsOwed())

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('A steel supplier')).toBeTruthy()
    expect(within(rows[0]).getByText('1,000,000')).toBeTruthy()
    expect(within(rows[0]).getByText('250,000')).toBeTruthy()
  })

  it('says an advance is an advance rather than a balance below nothing', async () => {
    renderWith(whatIsOwed())

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[1]).getByText('150,000 adv')).toBeTruthy()
    expect(document.body.textContent).not.toContain('-150,000')
  })

  it('breaks the one balance down by house only when asked, and only where there is more than one', async () => {
    renderWith(whatIsOwed())
    await screen.findAllByRole('listitem')

    // The man on one house has nothing to break down.
    expect(screen.queryByRole('button', { name: 'Which houses A mason is owed on' })).toBeNull()

    const opening = screen.getByRole('button', { name: 'Which houses A steel supplier is owed on' })
    expect(screen.queryByText('2-B, Phase 0')).toBeNull()

    fireEvent.click(opening)

    // Largest owed first, so the house being asked about is the one at the top.
    const houses = screen.getAllByRole('link').map((link) => link.textContent)
    expect(houses).toContain('2-B, Phase 0')
    expect(screen.getByText('400,000')).toBeTruthy()
  })

  it('opens a person’s account from their name, which is where the detail behind a balance is', async () => {
    renderWith(whatIsOwed())

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByRole('link', { name: 'A steel supplier' }).getAttribute('href')).toBe('/people/p1')
  })

  it('says what to do when nothing is owed to anybody', async () => {
    renderWith(whatIsOwed({ everyone: [], payablePaisa: 0, advancedPaisa: 0 }))

    expect(await screen.findByText(/Nothing is owed to anybody yet/)).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('keeps the two unknowns apart rather than folding them together', () => {
    const { unmount } = render(<WhatWeOwe owed={undefined} />)
    expect(screen.getByRole('status', { name: 'Working out what is owed' })).toBeTruthy()
    unmount()

    // The ledger has answered and does not know this sign-in, which is not a slow read.
    render(<WhatWeOwe owed={null} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/sign-in/i)).toBeTruthy()
  })

  it('says nothing technical anywhere on it', async () => {
    renderWith(whatIsOwed())
    await screen.findAllByRole('listitem')

    expect(document.body.textContent).not.toMatch(THE_MACHINE_SHOWING)
  })

  it('still refuses every word that is the machine showing through', () => {
    // The floor for the line above. A rule that lost one word to a ruling is one edit from losing the rest, and `not.toMatch` against a pattern somebody has emptied passes on anything at all -- so each banned word is asked for by name.
    for (const leaking of ['entity', 'paisa', 'query', 'database', 'null', 'undefined']) {
      expect(`A ${leaking} on the screen`, `${leaking} is no longer refused`).toMatch(THE_MACHINE_SHOWING)
    }

    expect('Outstanding', 'a word he chose himself is not the machine showing through').not.toMatch(THE_MACHINE_SHOWING)
  })
})
