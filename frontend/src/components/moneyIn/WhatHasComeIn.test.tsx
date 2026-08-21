// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ComeIn } from './WhatHasComeIn'
import { WhatHasComeIn } from './WhatHasComeIn'

afterEach(cleanup)

// A partner has put 2,000,000 in, the client has paid 5,500,000, and the house has not been sold.
const FUNDED_AND_PAID: ComeIn = {
  byWhy: { partnerMoney: 200_000_000, clientPayment: 550_000_000, sale: 0 },
  receivedPaisa: 750_000_000,
}

// Rendered where it really lives, so a link to a route that is gone fails here rather than under somebody's finger.
function renderWith(totals: ComeIn | null | undefined) {
  const root = createRootRoute({ component: () => <WhatHasComeIn siteId="s1" totals={totals} /> })
  const comingIn = createRoute({ getParentRoute: () => root, path: '/sites/$siteId/receipts', component: () => null })
  const router = createRouter({
    routeTree: root.addChildren([comingIn]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(<RouterProvider router={router} />)
}

function theRowFor(label: string) {
  return screen.getAllByRole('row').filter((row) => row.textContent.includes(label))[0]
}

describe('what has come in on a house', () => {
  it('says the whole of it, as one figure', async () => {
    renderWith(FUNDED_AND_PAID)
    await screen.findByText('Come in')

    // 7,500,000 rupees: every receipt on the house, which is what the total means.
    expect(screen.getByText('7,500,000')).toBeTruthy()
  })

  it('splits it three ways, because they are not the same kind of money', async () => {
    renderWith(FUNDED_AND_PAID)
    await screen.findByText('Come in')

    expect(within(theRowFor('Partner investment')).getByText('2,000,000')).toBeTruthy()
    expect(within(theRowFor('Client payment')).getByText('5,500,000')).toBeTruthy()
  })

  it('says on the row which of them is funding and which the house brought in', async () => {
    // The distinction the whole profit split stands on: counting capital as income makes a house look profitable the moment somebody funds it. Three figures under one heading read as three parts of one thing, and one of these is not.
    renderWith(FUNDED_AND_PAID)
    await screen.findByText('Come in')

    expect(theRowFor('Partner investment').textContent).toContain('Partner investment')
    expect(theRowFor('Client payment').textContent).toContain('Client & sale')
    expect(theRowFor('Sale proceeds').textContent).toContain('Client & sale')
  })

  it('shows a reason nothing has come in under as nothing, rather than leaving it out', async () => {
    // A house that has not sold still has a line for the sale. A reason that goes missing is a reason nobody remembers to ask about.
    renderWith(FUNDED_AND_PAID)
    await screen.findByText('Come in')

    expect(within(theRowFor('Sale proceeds')).getByText('0')).toBeTruthy()
  })

  it('adds no fourth figure of its own', async () => {
    // What the house brought in is the client and the sale together, and `partners.queries.positions` already works it out. A second answer to that on this screen is two figures that can disagree.
    renderWith(FUNDED_AND_PAID)
    await screen.findByText('Come in')

    // Every figure on the screen, counted: the whole, and the three it is made of. A fourth would be a second answer to a question `partners.queries.positions` already answers, and two figures that can disagree.
    const figures = screen.getAllByText(/^[\d,]+$/).map((said) => said.textContent)

    expect(figures).toEqual(['7,500,000', '2,000,000', '5,500,000', '0'])
  })

  it('offers the way to put money in, from the house it is about', async () => {
    renderWith(FUNDED_AND_PAID)

    const goingThere = await screen.findByRole('link', { name: 'Add' })
    expect(goingThere.getAttribute('href')).toBe('/sites/s1/receipts')
  })

  it('holds the shape of what is coming while it is coming', async () => {
    renderWith(undefined)

    expect(await screen.findByRole('status', { name: 'Getting what has come in' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('says a refusal is a refusal rather than showing it as nothing received', async () => {
    // Zero is a figure somebody could act on. A read that did not come back has not said anything, and drawing it as zero puts a number on the screen that nobody gave.
    renderWith(null)
    await screen.findByText('Come in')

    expect(screen.getByText(/did not come back/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
