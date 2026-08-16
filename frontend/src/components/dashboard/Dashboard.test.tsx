// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatIsHappening } from './Dashboard'
import { Dashboard } from './Dashboard'
import { asAMonth } from './MoneyByMonth'

afterEach(cleanup)

// A partner has put 1,24,00,000 of his own in, the client has paid, and money has gone out across two houses.
const BUSY: WhatIsHappening = {
  owed: { payablePaisa: 763_701_00, advancedPaisa: 150_000_00 },
  goneOutPaisa: 8_500_000_00,
  comeIn: { receivedPaisa: 12_000_000_00, ownMoneyPaisa: 1_240_000_00 },
  whereItWent: [
    { tradeId: 't1', name: 'Civil labour', paisa: 4_000_000_00 },
    { tradeId: null, name: 'Everything else (12)', paisa: 500_000_00 },
  ],
  whatCameIn: [
    { month: '2026-03', ownMoneyPaisa: 1_240_000_00, broughtInPaisa: 0 },
    { month: '2026-04', ownMoneyPaisa: 0, broughtInPaisa: 10_760_000_00 },
  ],
  // Every figure distinct from every other, including the ones the app derives. A house whose figure equals a tile's is how an assertion passes by finding the wrong one -- which this fixture did on its first run.
  houses: [
    { siteId: 's1', name: '1-A, Phase 0', stage: 'building', goneOutPaisa: 8_100_000_00, comeInPaisa: 11_500_000_00 },
    { siteId: 's2', name: '2-B, Phase 0', stage: 'planning', goneOutPaisa: 470_000_00, comeInPaisa: 320_000_00 },
  ],
  nothingYet: false,
}

// His first day: one house, nothing entered against it.
const HIS_FIRST_DAY: WhatIsHappening = {
  owed: { payablePaisa: 0, advancedPaisa: 0 },
  goneOutPaisa: 0,
  comeIn: { receivedPaisa: 0, ownMoneyPaisa: 0 },
  whereItWent: [],
  whatCameIn: [],
  houses: [{ siteId: 's1', name: '1-A, Phase 0', stage: 'planning', goneOutPaisa: 0, comeInPaisa: 0 }],
  nothingYet: true,
}

function renderIt(what: WhatIsHappening | null | undefined) {
  const root = createRootRoute({ component: () => <Dashboard what={what} /> })
  const kids = ['/', '/people', '/sites/$siteId'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null })
  )
  const router = createRouter({
    routeTree: root.addChildren(kids),
    history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
  })

  render(<RouterProvider router={router} />)
}

describe('everything at once', () => {
  it('gives every figure in this fixture one of its own', () => {
    // The control on the fixture rather than on the screen. Two ideas sharing a figure is how an assertion finds the wrong one, and this fixture did exactly that: the total that came in and one house's share of it were the same number.
    const figures = [
      BUSY.owed.payablePaisa,
      BUSY.owed.advancedPaisa,
      BUSY.goneOutPaisa,
      BUSY.comeIn.receivedPaisa,
      BUSY.comeIn.ownMoneyPaisa,
      ...BUSY.houses.flatMap((house) => [house.goneOutPaisa, house.comeInPaisa]),
    ]

    expect(new Set(figures).size).toBe(figures.length)
  })

  it('says how much of what came in is his own money, under the figure it is part of', async () => {
    // The one line I would not let a reviewer cut. Without it the biggest number on the screen reads as profit, and a house is not profitable the moment somebody funds it.
    renderIt(BUSY)
    await screen.findByText('Come in')

    expect(screen.getByText('1,240,000 of it is your own money.')).toBeTruthy()
    // Said beside the total rather than taken out of it: it did come in.
    expect(screen.getByText('12,000,000')).toBeTruthy()
  })

  it('says so plainly when none of it is his own', async () => {
    renderIt({ ...BUSY, comeIn: { receivedPaisa: 12_000_000_00, ownMoneyPaisa: 0 } })
    await screen.findByText('Come in')

    expect(screen.getByText('None of it is your own money.')).toBeTruthy()
  })

  it('never nets an advance into what is owed', async () => {
    // An advance held by the tile man is not money available to pay the steel man, so the two are two sentences and never one figure.
    renderIt(BUSY)
    await screen.findByText('Owed right now')

    expect(screen.getByText('763,701')).toBeTruthy()
    expect(screen.getByText('150,000 is held in advance, which is not money to pay anybody with.')).toBeTruthy()
    // 613,701 is what a netted figure would say. Nothing on the screen says it.
    expect(screen.queryByText('613,701')).toBeNull()
  })

  it('draws where the money went against the largest of them, and names the tail', async () => {
    renderIt(BUSY)
    const bars = await screen.findByRole('list', { name: 'Where it went' })

    // The gathered tail is a row like any other, so nothing is dropped off the end of the chart.
    expect(within(bars).getByText('Everything else (12)')).toBeTruthy()
    expect(within(bars).getAllByRole('listitem')).toHaveLength(2)
  })

  it('lists the houses, each one a way into it', async () => {
    renderIt(BUSY)
    await screen.findByText('The houses')

    const goingThere = screen.getByRole('link', { name: '1-A, Phase 0' })
    expect(goingThere.getAttribute('href')).toBe('/sites/s1')
    expect(screen.getByText('Planning')).toBeTruthy()
  })

  it('says a month the way somebody says it', () => {
    expect(asAMonth('2026-03')).toBe('Mar 26')
    expect(asAMonth('2026-12')).toBe('Dec 26')
    // A month it cannot read is said as it stands rather than as a wrong month.
    expect(asAMonth('nonsense')).toBe('nonsense')
  })
})

describe('the screen he sees first', () => {
  it('is its own screen, not the other one with zeroes in it', async () => {
    // A dashboard whose first day is four zeroes with charts drawn over nothing is what everybody ships.
    renderIt(HIS_FIRST_DAY)
    await screen.findByText('Nothing has gone in yet.')

    expect(screen.queryByText('Owed right now')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Where it went' })).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('says what to do next, and counts the houses he already has', async () => {
    renderIt(HIS_FIRST_DAY)

    expect(await screen.findByText(/One house is down and nothing has been entered against it yet/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to the houses' })).toBeTruthy()
  })

  it('says something else again when there is no house at all', async () => {
    renderIt({ ...HIS_FIRST_DAY, houses: [] })

    expect(await screen.findByText(/Start a house, and what it costs/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start a house' })).toBeTruthy()
  })
})

describe('before it has answered', () => {
  it('holds the shape of the tiles rather than a word', async () => {
    renderIt(undefined)

    expect(await screen.findByRole('status', { name: 'Getting everything' })).toBeTruthy()
    expect(screen.queryByText('Nothing has gone in yet.')).toBeNull()
  })

  it('says a refusal is a refusal rather than drawing an empty ledger', async () => {
    // Zero is a figure somebody could act on. A read that did not come back has not said anything.
    renderIt(null)

    expect(await screen.findByText(/did not come back/)).toBeTruthy()
    expect(screen.queryByText('Nothing has gone in yet.')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
