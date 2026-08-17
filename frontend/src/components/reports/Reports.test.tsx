// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { whatTheBooksAnswer } from '../../routes/reports'
import type { WhatTheBooksAnswer } from './Reports'
import { Reports, ReportsWaiting } from './Reports'

afterEach(cleanup)

// Every figure different, because a card reading the wrong field looks exactly like a working card when two of them happen to match.
function theBooks(over: Partial<WhatTheBooksAnswer> = {}): WhatTheBooksAnswer {
  return {
    spending: { trades: 7, goneOutPaisa: 199_384_52, ownMoneyPaisa: 65_400_00 },
    owed: { people: 3, payablePaisa: 34_125_00 },
    ...over,
  }
}

// The cards are links, so they need somewhere to point.
function renderWith(what: WhatTheBooksAnswer | null) {
  const root = createRootRoute({ component: () => <Reports what={what} /> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)
}

describe('the questions the books get asked', () => {
  it('offers the three the ledger can answer, and not the one it cannot', async () => {
    renderWith(theBooks())

    const cards = await screen.findAllByRole('listitem')
    expect(cards.map((card) => within(card).getByRole('link').textContent)).toHaveLength(3)

    expect(screen.getByText('Spending by category')).toBeTruthy()
    expect(screen.getByText('Who is owed what')).toBeTruthy()
    expect(screen.getByText('Partner positions')).toBeTruthy()

    // Nothing holds what a house was expected to cost, so the card promising that answer is not drawn at all.
    expect(document.body.textContent).not.toMatch(/estimate/i)
  })

  it('opens the screen that answers it, and card four does not open the receipts', async () => {
    renderWith(theBooks())

    const cards = await screen.findAllByRole('listitem')
    const goes = cards.map((card) => within(card).getByRole('link').getAttribute('href'))

    // The drawing sends partner positions to the receipts screen, which is money arriving rather than what anybody's share came to. Shares are agreed per house, so it opens the houses.
    expect(goes).toEqual(['/dashboard', '/owed', '/'])
    expect(goes).not.toContain('/money-in')
  })

  it('carries a live figure on each one, so a card is a reading and not a menu item', async () => {
    renderWith(theBooks())

    const cards = await screen.findAllByRole('listitem')
    expect(within(cards[0]).getByText(/7 trades/)).toBeTruthy()
    expect(within(cards[0]).getByText('199,384.52')).toBeTruthy()
    expect(within(cards[1]).getByText(/3 people/)).toBeTruthy()
    expect(within(cards[1]).getByText('34,125')).toBeTruthy()
    expect(within(cards[2]).getByText('65,400')).toBeTruthy()
  })

  it('says nothing about how old a balance is, which is what it cannot know', async () => {
    renderWith(theBooks())
    await screen.findAllByRole('listitem')

    // The drawing says "every open balance with its age". There is no allocation rule, so no bill has a state of its own -- and an age beside a balance is read as a claim about when that money fell due.
    expect(document.body.textContent).not.toMatch(/\bage\b|overdue|past due|days/i)
  })

  it('keeps the two unknowns apart rather than folding them together', () => {
    // The shape while it waits is the route's, because deciding it is still waiting is the route's -- two readings feed these cards. Both halves are asked for here so neither can go missing quietly.
    const { unmount } = render(<ReportsWaiting />)
    expect(screen.getByRole('status', { name: 'Getting the figures behind each one' })).toBeTruthy()
    unmount()

    render(<Reports what={null} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/sign-in/i)).toBeTruthy()
  })
})

describe('the two readings behind the cards', () => {
  const happening = { goneOutPaisa: 199_384_52, comeIn: { ownMoneyPaisa: 65_400_00 }, whereItWent: [{}, {}, {}] }
  const owed = {
    everyone: [{ outstandingPaisa: 750_000_00 }, { outstandingPaisa: 58_000_00 }, { outstandingPaisa: -150_000_00 }],
    payablePaisa: 808_000_00,
  }

  it('waits while either one is still coming, rather than drawing half the figures', () => {
    expect(whatTheBooksAnswer(undefined, owed)).toBeUndefined()
    expect(whatTheBooksAnswer(happening, undefined)).toBeUndefined()
  })

  it('refuses when either one refuses, which is what the screens behind the cards do', () => {
    expect(whatTheBooksAnswer(null, owed)).toBeNull()
    expect(whatTheBooksAnswer(happening, null)).toBeNull()

    // And a refusal is not a wait: folding the two together is how a refusal reads as a spinner that never stops.
    expect(whatTheBooksAnswer(null, owed)).not.toBeUndefined()
  })

  it('counts who is owed something rather than how long the list is', () => {
    // Three people on the owed screen, one of them holding an advance. He is not somebody the partnership owes, so the card says two.
    expect(whatTheBooksAnswer(happening, owed)?.owed.people).toBe(2)
    expect(whatTheBooksAnswer(happening, owed)?.owed.payablePaisa).toBe(808_000_00)
  })

  it('takes every figure off the reading the screen behind it uses', () => {
    const cards = whatTheBooksAnswer(happening, owed)

    expect(cards?.spending.trades).toBe(3)
    expect(cards?.spending.goneOutPaisa).toBe(199_384_52)
    expect(cards?.spending.ownMoneyPaisa).toBe(65_400_00)
  })
})
