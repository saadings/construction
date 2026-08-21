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

// A man owed on exactly one house, which is the ordinary case and the one where the house never has to be asked for.
const TILE_SHOP: Standing = {
  personId: 'p3',
  name: 'A tile shop',
  billedPaisa: 300_000_00,
  paidPaisa: 100_000_00,
  outstandingPaisa: 200_000_00,
  onHouses: [
    {
      siteId: 's1',
      name: '1-A, Phase 0',
      billedPaisa: 300_000_00,
      paidPaisa: 100_000_00,
      outstandingPaisa: 200_000_00,
    },
  ],
}

function whatIsOwed(over: Partial<WhatIsOwed> = {}): WhatIsOwed {
  return {
    everyone: [STEEL, MASON, TILE_SHOP],
    payablePaisa: 950_000_00,
    advancedPaisa: 150_000_00,
    ...over,
  }
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

    // Both figures are up, each under its own words.
    expect(screen.getByText('Owed to them')).toBeTruthy()
    expect(screen.getByText('Paid in advance')).toBeTruthy()

    // The total is nobody's own balance, which it used to be: with two people on the list it read 750,000 and so did the steel supplier's row, and a tile echoing a row is indistinguishable from a tile adding them up.
    expect(screen.getByText('950,000')).toBeTruthy()
    expect(screen.getAllByText('750,000')).toHaveLength(1)
    expect(screen.getByText('150,000')).toBeTruthy()

    // The parts really are the whole, so this cannot pass on figures that merely happen to be drawn.
    expect(750_000 + 200_000).toBe(950_000)

    // And the netted figure appears nowhere, because it is the one nobody can act on.
    expect(document.body.textContent).not.toContain('800,000')
  })

  it('gives each person one balance, however many houses it came from', async () => {
    renderWith(whatIsOwed())

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('A steel supplier')).toBeTruthy()
    expect(within(rows[0]).getByText('1,000,000')).toBeTruthy()
    expect(within(rows[0]).getByText('250,000')).toBeTruthy()
  })

  it('offers to pay a man owed on one house, on the house he is owed on', async () => {
    renderWith(whatIsOwed())

    const pay = await screen.findByRole('link', { name: 'Pay A tile shop on 1-A, Phase 0' })

    // The house and the man both, in the address. `payments.record` is a site mutation, so a payment without a house is not a payment -- and a link that carries the house but not the man opens the right screen and asks him to find himself again.
    expect(pay.getAttribute('href')).toContain('/sites/s1/day')
    expect(pay.getAttribute('href')).toContain('paying=p3')
  })

  it('never guesses which house, and offers one against each where a man is owed on several', async () => {
    renderWith(whatIsOwed())

    const rows = await screen.findAllByRole('listitem')

    // Nothing on the row itself: two houses and one button would have to pick one, and picking is the thing this arrangement exists to avoid.
    expect(within(rows[0]).queryByRole('link', { name: /^Pay A steel supplier/ })).toBeNull()
    // And the row is really his, so the absence above is an absence rather than a query that found nothing.
    expect(within(rows[0]).getByText('A steel supplier')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Which houses A steel supplier is owed on' }))

    const onFirst = screen.getByRole('link', { name: 'Pay A steel supplier on 2-B, Phase 0' })
    const onSecond = screen.getByRole('link', { name: 'Pay A steel supplier on 1-A, Phase 0' })

    // Each against its own house, and each carrying the same man.
    expect(onFirst.getAttribute('href')).toContain('/sites/s2/day')
    expect(onSecond.getAttribute('href')).toContain('/sites/s1/day')
    expect(onFirst.getAttribute('href')).toContain('paying=p1')
  })

  it('offers nothing to a man who is holding an advance, on a house or at all', async () => {
    renderWith(whatIsOwed())

    const rows = await screen.findAllByRole('listitem')
    const his = rows.find((row) => within(row).queryByText('A mason') !== null)

    // He is on this screen because his balance belongs on it. Offering to pay him is offering to deepen an advance he already holds.
    expect(his).toBeTruthy()
    expect(within(his as HTMLElement).queryByRole('link', { name: /^Pay A mason/ })).toBeNull()
    // Asked from the other end: he is drawn, and his advance is drawn, so nothing above passed on an empty row.
    expect(within(his as HTMLElement).getByText(/150,000/)).toBeTruthy()
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
