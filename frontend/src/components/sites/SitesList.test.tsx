// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { SiteRow } from './SitesList'
import { SitesList, acrossTheEstimate, howWideTheBarIs } from './SitesList'

afterEach(cleanup)

// The rows carry links, so they need somewhere to point. Nothing here is being tested about routing itself.
function renderAt(sites: Array<SiteRow>) {
  const root = createRootRoute()
  const home = createRoute({ getParentRoute: () => root, path: '/', component: () => <SitesList sites={sites} /> })
  const nowhere = createRoute({ getParentRoute: () => root, path: '$', component: () => null })
  const router = createRouter({
    routeTree: root.addChildren([home, nowhere]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(<RouterProvider router={router} />)
}

const aHouse: SiteRow = {
  _id: 's1',
  name: '1-A, Phase 0',
  stage: 'building',
  builtForAClient: false,
  spentPaisa: 497498000,
  receivedPaisa: 612000000,
}

describe('the sites on the home screen', () => {
  it('gives each site its name, where it has got to and one number', async () => {
    renderAt([aHouse])

    const row = await screen.findByRole('listitem')
    expect(within(row).getByText('1-A, Phase 0')).toBeTruthy()
    expect(within(row).getByText('Building')).toBeTruthy()
    // Comma grouped, no decimals unless the figure has them, the way the workbooks write it.
    expect(within(row).getByText('4,974,980')).toBeTruthy()
  })

  it('says a client job is one', async () => {
    renderAt([{ ...aHouse, builtForAClient: true, stage: 'complete' }])

    const row = await screen.findByRole('listitem')
    // "Complete" is what the stage is called underneath; "Finished" is what a person calls it.
    expect(within(row).getByText(/Finished/)).toBeTruthy()
    expect(within(row).getByText(/For a client/)).toBeTruthy()
  })

  it('measures spending against the estimate, and says so when there is none', async () => {
    renderAt([
      { ...aHouse, budgetEstimatePaisa: 1_000_000_00, spentPaisa: 250_000_00 },
      { ...aHouse, _id: 's2', name: '204-C, Phase 6', budgetEstimatePaisa: undefined },
    ])

    const cards = await screen.findAllByRole('listitem')

    // A quarter of the estimate spent, said as a share rather than left to be worked out from two figures.
    expect(within(cards[0]).getByText('25%')).toBeTruthy()
    expect(within(cards[0]).getByText(/Spent against estimate/)).toBeTruthy()

    // And the house nobody has estimated says what is missing rather than drawing an empty track. A blank reads as broken.
    expect(within(cards[1]).getByText(/No estimate set/)).toBeTruthy()
    expect(within(cards[1]).queryByText(/Spent against estimate/)).toBeNull()
  })

  it('says how far past the estimate a house has gone, rather than stopping at the limit', async () => {
    renderAt([{ ...aHouse, budgetEstimatePaisa: 100_000_00, spentPaisa: 250_000_00 }])

    const card = await screen.findByRole('listitem')

    // Two and a half times the estimate. The figure says so; only the bar's width is capped, because a bar cannot draw past its own track and a percentage has no such limit.

    // `100%` shipped here, and it is the value a capped overspend produces **and** the value a house spent to the rupee produces -- one string for two states, which is the failure this app keeps finding.
    expect(within(card).getByText('250%')).toBeTruthy()
    expect(within(card).getByText('250%').className).toContain('text-destructive')
    expect(within(card).queryByText('100%')).toBeNull()
  })

  it('draws the bar inside its own track however far past the spending has gone', async () => {
    renderAt([{ ...aHouse, budgetEstimatePaisa: 100_000_00, spentPaisa: 250_000_00 }])

    const card = await screen.findByRole('listitem')
    const bar = card.querySelector<HTMLElement>('[data-bar]')

    expect(bar, 'the card draws no bar to measure').not.toBeNull()
    expect(bar?.style.width).toBe('100%')
  })

  it('says who a house is for in each of the three ways it can be', async () => {
    renderAt([
      { ...aHouse, clientName: 'The one it is built for', builtForAClient: true },
      { ...aHouse, _id: 's2', name: '204-C', builtForAClient: true },
      { ...aHouse, _id: 's3', name: '12-B', builtForAClient: false },
    ])

    const cards = await screen.findAllByRole('listitem')

    expect(within(cards[0]).getByText(/For The one it is built for/)).toBeTruthy()
    // A client house with nobody named on it still says it is one, which is what the table's `Whose` column carried.
    expect(within(cards[1]).getByText(/For a client/)).toBeTruthy()
    expect(within(cards[2]).getByText(/Ours to sell/)).toBeTruthy()
  })

  it('leaves out an area nobody has put in, rather than an orphan separator', async () => {
    renderAt([
      { ...aHouse, coveredAreaSqft: 5400 },
      { ...aHouse, _id: 's2', name: '204-C' },
    ])

    const cards = await screen.findAllByRole('listitem')

    expect(within(cards[0]).getByText(/5,400 sqft/)).toBeTruthy()
    // The separator belongs to the pair rather than to the line.
    expect(within(cards[1]).queryByText(/·/)).toBeNull()
  })

  it('has something to say when there are no sites yet', async () => {
    renderAt([])

    expect(await screen.findByText(/No houses yet/)).toBeTruthy()
    // An empty screen with no way forward is a dead end, so the way to start one is still there -- at both widths, since only one of the two is ever on screen.
    expect(screen.getAllByRole('link', { name: 'Add a site' })).toHaveLength(2)
  })

  it('never puts a technical word on the screen', async () => {
    renderAt([aHouse, { ...aHouse, _id: 's2', name: '2-B, Phase 0', builtForAClient: true, stage: 'sold' }])

    await screen.findAllByRole('listitem')
    const onScreen = document.body.textContent.toLowerCase()

    for (const technical of [
      'record',
      'entry',
      'entity',
      'ledger',
      'sync',
      'category',
      'vendor',
      'field',
      'validation',
      'required',
      'error',
      'database',
      'query',
    ]) {
      expect(onScreen).not.toContain(technical)
    }
    // The control: the loop above passes against a blank screen.
    expect(onScreen).toContain('1-a, phase 0')
  })
})

describe('the share of an estimate, and the width of the bar that draws it', () => {
  it('are the same number until the spending goes past the estimate', () => {
    expect(acrossTheEstimate(50, 100)).toBe(50)
    expect(howWideTheBarIs(acrossTheEstimate(50, 100))).toBe(50)
  })

  it('part company past it, which is the whole of the defect that shipped', () => {
    // 112% on `204-C`, drawn as a full track and said as twelve per cent past.
    expect(acrossTheEstimate(8_140_000, 7_250_000)).toBe(112)
    expect(howWideTheBarIs(acrossTheEstimate(8_140_000, 7_250_000))).toBe(100)
  })

  it('answer for a house with no estimate to be measured against, rather than dividing by it', () => {
    expect(acrossTheEstimate(500, 0)).toBe(0)
    expect(acrossTheEstimate(0, 0)).toBe(0)
    expect(howWideTheBarIs(0)).toBe(0)
  })
})
