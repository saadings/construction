// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatIsHappening } from './Dashboard'
import { Dashboard } from './Dashboard'
import { A_SUMMARY, asAMonth } from './MoneyByMonth'

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
  // Adds to `comeIn` on purpose -- 610,000 + 630,000 is the 1,240,000 of his own money, and the four together are the 12,000,000 that has come in. A fixture whose parts do not add up is one where an assertion about a total can pass off the wrong figure.
  whatCameIn: [
    { month: '2026-03', ownMoneyPaisa: 610_000_00, broughtInPaisa: 4_260_000_00 },
    { month: '2026-04', ownMoneyPaisa: 630_000_00, broughtInPaisa: 6_500_000_00 },
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
  const kids = ['/', '/people', '/sites/$siteId', '/money-in'].map((path) =>
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

    // It grew when the month chart stopped being a chart. Its figures were readable only through a hover tooltip, so they were on no screen and in no assertion's way; drawn as text they are twelve more numbers a `getByText` can land on, and `2026-03` was carrying the same 1,240,000 as the tile above it.

    // Which is the rule: this list is every figure the screen renders, so it goes stale the moment a figure that was hidden becomes visible. Adding to the screen means adding here.
    const figures = [
      BUSY.owed.payablePaisa,
      BUSY.owed.advancedPaisa,
      BUSY.goneOutPaisa,
      BUSY.comeIn.receivedPaisa,
      BUSY.comeIn.ownMoneyPaisa,
      // Worked out by the screen and drawn on it, so it is as capable of colliding as any of the others.
      BUSY.comeIn.receivedPaisa - BUSY.goneOutPaisa,
      ...BUSY.whereItWent.map((one) => one.paisa),
      ...BUSY.whatCameIn.flatMap((one) => [one.ownMoneyPaisa, one.broughtInPaisa]),
      ...BUSY.houses.flatMap((house) => [house.goneOutPaisa, house.comeInPaisa]),
    ]

    expect(new Set(figures).size).toBe(figures.length)
  })

  it('says how much of what came in is his own money, under the figure it is part of', async () => {
    // The one line I would not let a reviewer cut. Without it the biggest number on the screen reads as profit, and a house is not profitable the moment somebody funds it.
    renderIt(BUSY)

    // Waited for by the sentence this test is about rather than by the tile's label. `Invested` names the tile and now also names a column of the houses table, and a wait that matches two things is a wait that stops meaning one of them.
    expect(await screen.findByText('1,240,000 of it is your own money.')).toBeTruthy()
    // Said beside the total rather than taken out of it: it did come in.
    expect(screen.getByText('12,000,000')).toBeTruthy()
  })

  it('says so plainly when none of it is his own', async () => {
    renderIt({ ...BUSY, comeIn: { receivedPaisa: 12_000_000_00, ownMoneyPaisa: 0 } })

    expect(await screen.findByText('None of it is your own money.')).toBeTruthy()
  })

  it('never nets an advance into what is owed', async () => {
    // An advance held by the tile man is not money available to pay the steel man, so the two are two sentences and never one figure.
    renderIt(BUSY)
    await screen.findByText('Outstanding')

    expect(screen.getByText('763,701')).toBeTruthy()
    expect(screen.getByText('150,000 is held in advance, which is not money to pay anybody with.')).toBeTruthy()
    // 613,701 is what a netted figure would say. Nothing on the screen says it.
    expect(screen.queryByText('613,701')).toBeNull()
  })

  it('draws where the money went against the largest of them, and names the tail', async () => {
    renderIt(BUSY)
    const bars = await screen.findByRole('list', { name: 'Spent by trade' })

    // The gathered tail is a row like any other, so nothing is dropped off the end of the chart.
    expect(within(bars).getByText('Everything else (12)')).toBeTruthy()
    expect(within(bars).getAllByRole('listitem')).toHaveLength(2)
  })

  it('lists the houses, each one a way into it', async () => {
    renderIt(BUSY)
    await screen.findByText('Sites')

    const goingThere = screen.getByRole('link', { name: '1-A, Phase 0' })
    expect(goingThere.getAttribute('href')).toBe('/sites/s1')
    expect(screen.getByText('Planning')).toBeTruthy()
  })

  it('says what came in each month, in figures, rather than in bar heights alone', async () => {
    // The whole reason this stopped being a chart. recharts drew four bars, an axis of months and a legend, and the amount was readable only through a hover tooltip -- which on a phone is a tap-and-hold nobody discovers. `Spent by trade` sits directly above it saying its figure on every row.
    renderIt(BUSY)

    const broughtIn = await screen.findByRole('list', { name: 'Brought in' })
    const ownMoney = screen.getByRole('list', { name: 'Own funds' })

    // Each series named in words over its own rows, so the two greens agree with a label rather than standing in for one. A legend of two swatches is exactly the colour-alone reading the houses table was fixed for.
    expect(within(broughtIn).getByText('4,260,000')).toBeTruthy()
    expect(within(ownMoney).getByText('610,000')).toBeTruthy()

    // And the month is on the row, or a figure is an amount belonging to nothing.
    expect(within(broughtIn).getAllByText('Mar 26')).toHaveLength(1)
    expect(within(ownMoney).getAllByText('Apr 26')).toHaveLength(1)
  })

  it('gives the camera something to watch a bar by', async () => {
    // The floor under `shots`, which waits for a screen to stop moving by measuring `[data-bar]`. It used to measure `.recharts-bar-rectangle`, which was a claim about a library rather than about this app -- and a selector that finds nothing reports a screen at rest, forever and quietly. This is where the marker is drawn, so this is where it is held to existing.
    renderIt(BUSY)

    // Waited for, because the router draws on a tick and a count taken before it has is zero -- which is the same answer this test exists to refuse. Asked first as its own failure, so the count below is about the marker rather than about the timing.
    await screen.findByRole('list', { name: 'Spent by trade' })

    // A number and not a floor: one for each trade, and one for each month in each of the two series.
    expect(document.querySelectorAll('[data-bar]').length).toBe(BUSY.whereItWent.length + BUSY.whatCameIn.length * 2)
  })

  it('shows only a summary of the months, and says so when it is holding some back', async () => {
    // A house takes a year or two and this list grows a row a month. A dashboard drawing twenty-four of them is not a summary, and the screen that holds all of it already exists.
    const many = Array.from({ length: 9 }, (_, at) => ({
      month: `2026-0${at + 1}`,
      ownMoneyPaisa: (at + 1) * 100_00,
      broughtInPaisa: (at + 1) * 1_000_00,
    }))

    renderIt({ ...BUSY, whatCameIn: many })

    const broughtIn = await screen.findByRole('list', { name: 'Brought in' })
    expect(within(broughtIn).getAllByRole('listitem')).toHaveLength(A_SUMMARY)

    // The last six and not the first six: what is happening now is what a summary is for.
    expect(within(broughtIn).queryByText('Mar 26')).toBeNull()
    expect(within(broughtIn).getByText('Sep 26')).toBeTruthy()

    // And a way to the rest, rather than figures that are simply not there.
    expect(screen.getByRole('link', { name: 'All of it' }).getAttribute('href')).toBe('/money-in')
  })

  it('says nothing about holding months back when it is holding none', async () => {
    // A permanent line about the last six months is a line about nothing for the first five.
    renderIt(BUSY)
    await screen.findByRole('list', { name: 'Brought in' })

    expect(screen.queryByRole('link', { name: 'All of it' })).toBeNull()
  })

  it('says what has come in and not gone out again, and refuses to be read as a bank balance', async () => {
    // The caveat is on the tile and not in a comment. A comment ships to nobody, and this sentence is the whole difference between a figure and a wrong figure: there is history behind this ledger whose outgoings were never entered.
    renderIt(BUSY)

    expect(await screen.findByText('Not yet spent')).toBeTruthy()
    // 12,000,000 in and 8,500,000 out.
    expect(screen.getByText('3,500,000')).toBeTruthy()
    expect(screen.getByText(/Not a bank balance/)).toBeTruthy()
  })

  it('says the other way round in a word rather than with a minus sign', async () => {
    // What this app does everywhere money can go the other way: `Owed` shows an advance as its own amount followed by `adv` rather than as a negative balance. A minus in front of a figure is a thing somebody reads past.
    renderIt({ ...BUSY, goneOutPaisa: 14_000_000_00 })

    expect(await screen.findByText('Spent past what came in')).toBeTruthy()
    expect(screen.getByText('2,000,000')).toBeTruthy()
    expect(screen.queryByText('-2,000,000')).toBeNull()
    expect(screen.getByText(/More has gone out than has come in/)).toBeTruthy()
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

    expect(screen.queryByText('Outstanding')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Spent by trade' })).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('says what to do next, and counts the houses he already has', async () => {
    renderIt(HIS_FIRST_DAY)

    expect(await screen.findByText(/One house is down and nothing has been entered against it yet/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to sites' })).toBeTruthy()
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
