// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { WhatIsHappening } from './Dashboard'
import { Dashboard } from './Dashboard'
import { theDaysNamed } from './NeedsYourAttention'

afterEach(cleanup)

// A partner has put 1,24,00,000 of his own in, the client has paid, and money has gone out across two houses.
const BUSY: WhatIsHappening = {
  asAt: '2026-04-15',
  owed: { payablePaisa: 763_701_00, advancedPaisa: 150_000_00, people: 3 },
  goneOutPaisa: 8_500_000_00,
  comeIn: { receivedPaisa: 12_000_000_00, ownMoneyPaisa: 1_240_000_00 },
  thisMonth: { month: '2026-04', paidOutPaisa: 4_500_000_00, entries: 47, receivedPaisa: 6_500_000_00 },
  whereItWent: [
    { tradeId: 't1', name: 'Civil labour', paisa: 4_000_000_00 },
    { tradeId: null, name: 'Everything else (12)', paisa: 500_000_00 },
  ],
  // The last pair is this month said again, which is what the screen draws beside the tiles. The other months are a window and come to less than the whole.
  inAndOut: [
    { month: '2026-03', inPaisa: 4_260_000_00, outPaisa: 3_100_000_00 },
    { month: '2026-04', inPaisa: 6_500_000_00, outPaisa: 4_500_000_00 },
  ],
  quietDays: ['2026-04-13', '2026-04-14'],
  // Every figure distinct from every other, including the ones the app derives. A house whose figure equals a tile's is how an assertion passes by finding the wrong one -- which this fixture did on its first run.
  houses: [
    {
      siteId: 's1',
      name: '1-A, Phase 0',
      stage: 'building',
      builtForAClient: true,
      forWhom: 'the family it is for',
      coveredAreaSqft: 5_400,
      goneOutPaisa: 8_100_000_00,
      comeInPaisa: 11_500_000_00,
    },
    {
      siteId: 's2',
      name: '2-B, Phase 0',
      stage: 'planning',
      builtForAClient: false,
      forWhom: null,
      coveredAreaSqft: null,
      goneOutPaisa: 470_000_00,
      comeInPaisa: 320_000_00,
    },
  ],
  nothingYet: false,
}

// His first day: one house, nothing entered against it.
const HIS_FIRST_DAY: WhatIsHappening = {
  asAt: '2026-04-15',
  owed: { payablePaisa: 0, advancedPaisa: 0, people: 0 },
  goneOutPaisa: 0,
  comeIn: { receivedPaisa: 0, ownMoneyPaisa: 0 },
  thisMonth: { month: '2026-04', paidOutPaisa: 0, entries: 0, receivedPaisa: 0 },
  whereItWent: [],
  inAndOut: [],
  quietDays: [],
  houses: [
    {
      siteId: 's1',
      name: '1-A, Phase 0',
      stage: 'planning',
      builtForAClient: true,
      forWhom: null,
      coveredAreaSqft: null,
      goneOutPaisa: 0,
      comeInPaisa: 0,
    },
  ],
  nothingYet: true,
}

function renderIt(what: WhatIsHappening | null | undefined) {
  const root = createRootRoute({ component: () => <Dashboard what={what} /> })
  const kids = ['/', '/people', '/sites/$siteId', '/receipts', '/reports'].map((path) =>
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

    // Which is the rule: this list is every figure the screen renders, so it goes stale the moment a figure that was hidden becomes visible. Adding to the screen means adding here.

    // The last month of `inAndOut` is left out because it is this month's two figures said again on purpose -- one number drawn twice, which is not a collision.
    const figures = [
      BUSY.owed.payablePaisa,
      BUSY.owed.advancedPaisa,
      BUSY.goneOutPaisa,
      BUSY.comeIn.receivedPaisa,
      BUSY.comeIn.ownMoneyPaisa,
      BUSY.thisMonth.paidOutPaisa,
      BUSY.thisMonth.receivedPaisa,
      // Worked out by the screen and drawn on it, so it is as capable of colliding as any of the others.
      BUSY.comeIn.receivedPaisa - BUSY.goneOutPaisa,
      ...BUSY.whereItWent.map((one) => one.paisa),
      ...BUSY.inAndOut.slice(0, -1).flatMap((one) => [one.inPaisa, one.outPaisa]),
      ...BUSY.houses.flatMap((house) => [house.goneOutPaisa, house.comeInPaisa]),
    ]

    expect(new Set(figures).size).toBe(figures.length)
  })

  it('says which day the figures are as at, and how many houses they cover', async () => {
    // Handed down from the query that counted them rather than read off the clock here. A heading naming a different day from the figures under it is worse than no heading, and this is the screen he checks against what he remembers doing yesterday.
    renderIt(BUSY)

    expect(await screen.findByText('Two sites · figures as at Wednesday, 15 April 2026')).toBeTruthy()
  })

  it('says what has come in and not gone out again, and refuses to be read as a bank balance', async () => {
    // His first tile is `Cash on hand`. Nothing here holds an opening balance, so this is the true version of the same idea and the caveat is on the tile rather than in a comment -- a comment ships to nobody, and this sentence is the whole difference between a figure and a wrong figure.
    renderIt(BUSY)

    expect(await screen.findByText('Not yet spent')).toBeTruthy()
    // 12,000,000 in and 8,500,000 out.
    expect(screen.getByText('3,500,000')).toBeTruthy()
    expect(screen.getByText(/Not a bank balance/)).toBeTruthy()
  })

  it('says the other way round in a word rather than with a minus sign', async () => {
    // What this app does everywhere money can go the other way: `Payables` shows an advance as its own amount followed by `adv` rather than as a negative balance. A minus in front of a figure is a thing somebody reads past.
    renderIt({ ...BUSY, goneOutPaisa: 14_000_000_00 })

    expect(await screen.findByText('Spent past what came in')).toBeTruthy()
    expect(screen.getByText('2,000,000')).toBeTruthy()
    expect(screen.queryByText('-2,000,000')).toBeNull()
    expect(screen.getByText(/More has gone out than has come in/)).toBeTruthy()
  })

  it('counts the entries behind what went out this month', async () => {
    // His own caption. It is what tells him whether a heavy month was one cheque or forty, and without it a figure that doubled says nothing about why.
    renderIt(BUSY)

    const label = await screen.findByText('Paid out this month')
    // Asked inside the tile rather than on the page. This figure is on the screen twice on purpose -- the chart header beside it says the same month -- and a `getByText` for it finds two things and fails for the wrong reason.
    const tile = label.closest('div')

    expect(tile).not.toBeNull()
    expect(within(tile as HTMLElement).getByText('Across 47 entries')).toBeTruthy()
    expect(within(tile as HTMLElement).getByText('4,500,000')).toBeTruthy()
  })

  it('never nets an advance into what is owed, and says how many people it is owed to', async () => {
    // An advance held by the tile man is not money available to pay the steel man, so the two are two sentences and never one figure.
    renderIt(BUSY)
    await screen.findByText('Outstanding payables')

    expect(screen.getByText('763,701')).toBeTruthy()
    expect(screen.getByText(/Owed to 3 people/)).toBeTruthy()
    expect(screen.getByText(/150,000 is held in advance, which is not money to pay anybody with/)).toBeTruthy()
    // 613,701 is what a netted figure would say. Nothing on the screen says it.
    expect(screen.queryByText('613,701')).toBeNull()
  })

  it('draws where the money went for this month, against the largest of them, and names the tail', async () => {
    renderIt(BUSY)
    const bars = await screen.findByRole('list', { name: 'Where the money went' })

    // The gathered tail is a row like any other, so nothing is dropped off the end of the chart.
    expect(within(bars).getByText('Everything else (12)')).toBeTruthy()
    expect(within(bars).getAllByRole('listitem')).toHaveLength(2)
    // The month is named, because `Where the money went` without one is the whole ledger and this is not.
    expect(screen.getByText('By category, April 2026')).toBeTruthy()
  })

  it('says the total of the category rows beside them', async () => {
    // What makes the rows checkable: a chart whose parts do not come to the figure beside it is a chart nobody can catch being wrong. It is also the tile above it said again.
    renderIt(BUSY)
    await screen.findByRole('list', { name: 'Where the money went' })

    // Asked inside the chart's own header rather than on the page. This month's outgoings are on the screen three times on purpose -- the tile, this header, and the sentence naming the heaviest month -- and a count of them is a test that breaks whenever a fourth true place to say it appears.
    const beside = (await screen.findByText('By category, April 2026')).closest('div')?.parentElement

    expect(beside).toBeTruthy()
    // 4,000,000 + 500,000, which is what the tile says as well.
    expect(within(beside as HTMLElement).getByText('4,500,000')).toBeTruthy()
  })

  it('says a month with nothing in it rather than drawing an empty card', async () => {
    // The first of every month, and the card he opens on. An empty card with a heading reads as a screen that failed to load.
    renderIt({ ...BUSY, whereItWent: [] })

    expect(await screen.findByText('Nothing has gone out this month yet.')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Where the money went' })).toBeNull()
  })

  it('puts both figures on each month of the in-and-out chart', async () => {
    // His columns carry no number at all. The heights are the whole of what a sighted reader gets, so the amounts are on each month's own label and in the sentence underneath -- otherwise this is the hover-tooltip chart that was taken out of this screen once already.
    renderIt(BUSY)
    const chart = await screen.findByRole('list', { name: 'Money in and out' })

    expect(within(chart).getByLabelText('April 2026: 6,500,000 in, 4,500,000 out')).toBeTruthy()
    expect(within(chart).getByLabelText('March 2026: 4,260,000 in, 3,100,000 out')).toBeTruthy()
    // And the axis says which month, or a column is a height belonging to nothing.
    expect(within(chart).getByText('Apr')).toBeTruthy()
  })

  it('names the heaviest month either way, with both its figures', async () => {
    // His own sentence under the chart. He wrote why it was heavy, which only a person knows; this says which month and what it was, which is what the columns cannot be read for.
    renderIt(BUSY)

    expect(await screen.findByText(/April 2026 was the heaviest month either way/)).toBeTruthy()
  })

  it('gives the camera something to watch a bar by', async () => {
    // The floor under `shots`, which waits for a screen to stop moving by measuring `[data-bar]`. It used to measure `.recharts-bar-rectangle`, which was a claim about a library rather than about this app -- and a selector that finds nothing reports a screen at rest, forever and quietly. This is where the marker is drawn, so this is where it is held to existing.
    renderIt(BUSY)

    // Waited for, because the router draws on a tick and a count taken before it has is zero -- which is the same answer this test exists to refuse.
    await screen.findByRole('list', { name: 'Where the money went' })

    // A number and not a floor: one for each category row, and two for each month of the in-and-out chart.
    expect(document.querySelectorAll('[data-bar]').length).toBe(BUSY.whereItWent.length + BUSY.inAndOut.length * 2)
  })

  it('says which days had nothing recorded on them', async () => {
    // The one row of `Needs your attention` this ledger can answer. His other two need a due date on a bill and an estimate on a site, and neither exists.
    renderIt(BUSY)

    expect(await screen.findByText('Needs your attention')).toBeTruthy()
    expect(screen.getByText('Nothing recorded on 13 and 14 April.')).toBeTruthy()
    expect(screen.getByText('Two days in the last week with no entries.')).toBeTruthy()
    // His pairing: the sentence says the word, the column beside it says the figure -- the column that holds `2,090,000` and `+11%` on the two rows this ledger cannot fill.
    expect(screen.getByText('2 days')).toBeTruthy()
  })

  it('names a run of days the way a person writes one', () => {
    // His own phrasing, month said once: `Nothing recorded on 10 and 11 March.`
    expect(theDaysNamed(['2026-03-10', '2026-03-11'])).toBe('10 and 11 March')
    expect(theDaysNamed(['2026-03-10'])).toBe('10 March')

    // A run crossing a month says both, because `30 and 1 June` is a date nobody can read.
    expect(theDaysNamed(['2026-05-30', '2026-06-01'])).toBe('30 May and 1 June')

    // Past three it counts rather than lists. Nine dates in a sentence is a sentence nobody finishes.
    expect(theDaysNamed(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'])).toBe(
      '10, 11, 12 March and 2 more'
    )
  })

  it('says nothing at all when there is nothing to say', async () => {
    // A block headed `Needs your attention` holding nothing is a block saying something is wrong every day of a year when nothing is.
    renderIt({ ...BUSY, quietDays: [] })
    await screen.findByText('Not yet spent')

    expect(screen.queryByText('Needs your attention')).toBeNull()
  })

  it('lists the houses, each one a way into it, with what it is under its name', async () => {
    renderIt(BUSY)
    await screen.findByText('Sites')

    const goingThere = screen.getByRole('link', { name: '1-A, Phase 0' })
    expect(goingThere.getAttribute('href')).toBe('/sites/s1')

    // The stage as a word on its own tinted plane, which is how he draws it here.
    expect(screen.getByText('Planning')).toBeTruthy()
    expect(screen.getByText('Building')).toBeTruthy()

    // Who it is going up for and how big it is, and his other phrasing on the house that is going up to sell.
    expect(screen.getByText('For the family it is for · 5,400 sqft')).toBeTruthy()
    expect(screen.getByText('Own build, for sale')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'All sites' }).getAttribute('href')).toBe('/')
  })

  it('keeps the way to all of them on one line', async () => {
    // At 390 the subtitle beside it wraps to two lines and takes the row's width with it, and this broke to `All` over `sites` with the arrow beside the second word -- a control reading as a rendering fault, on the screen he opens first.

    // Asserted on the class list because nothing else here can see it: jsdom lays nothing out, `columns` finds no misalignment and no squeezed cell, and the tap target measures fine. It was found by looking at a picture, and this is the only thing that would notice it going back.
    renderIt(BUSY)
    const wayThere = await screen.findByRole('link', { name: 'All sites' })

    expect(wayThere.className).toContain('whitespace-nowrap')
    // The half that matters. Without it the words stay together and the box overflows the row instead.
    expect(wayThere.className).toContain('shrink-0')
  })

  it('offers the whole of the reports from the header', async () => {
    // His header button. The tiles are a summary and somebody who wants all of it should not have to find the nav to say so.
    renderIt(BUSY)

    expect((await screen.findByRole('link', { name: 'Full reports' })).getAttribute('href')).toBe('/reports')
  })
})

describe('the screen he sees first', () => {
  it('is its own screen, not the other one with zeroes in it', async () => {
    // A dashboard whose first day is four zeroes with charts drawn over nothing is what everybody ships.
    renderIt(HIS_FIRST_DAY)
    await screen.findByText('Nothing has gone in yet.')

    expect(screen.queryByText('Outstanding payables')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Where the money went' })).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('says nothing about which day it is, on the day there is nothing to date', async () => {
    renderIt(HIS_FIRST_DAY)
    await screen.findByText('Nothing has gone in yet.')

    expect(screen.queryByText(/figures as at/)).toBeNull()
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
