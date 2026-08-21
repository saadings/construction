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
    // Two houses, and a total that is neither of theirs: a card reading one house's spending looks exactly like a card adding them up.
    houses: { count: 2, goneOutPaisa: 142_500_00 },
    spending: { trades: 7, thisMonthPaisa: 88_120_00, ownMoneyPaisa: 65_400_00 },
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
  it('offers all four now that the one it could not answer has an answer', async () => {
    renderWith(theBooks())

    const cards = await screen.findAllByRole('listitem')
    expect(cards).toHaveLength(4)

    // `Cost per house` was absent for as long as nothing held what a house was expected to cost. A field to put one in landed in the change before this, so the reason expired and the card is drawn.
    expect(screen.getByText('Cost per house')).toBeTruthy()
    expect(screen.getByText('Spending by category')).toBeTruthy()
    expect(screen.getByText('Who is owed what')).toBeTruthy()
    expect(screen.getByText('Partner positions')).toBeTruthy()
  })

  it('opens the screen that answers it, and card four opens the receipts as drawn', async () => {
    renderWith(theBooks())

    const cards = await screen.findAllByRole('listitem')
    const goes = cards.map((card) => within(card).getByRole('link').getAttribute('href'))

    // Partner positions opened the houses, on the argument that a share is agreed on the house it is for. The drawing points it at Receipts and the drawing is right: what a partner has put in **is** a receipt, under `Partner investment`.
    expect(goes).toEqual(['/', '/dashboard', '/owed', '/receipts'])
  })

  it('carries a live figure on each one, so a card is a reading and not a menu item', async () => {
    renderWith(theBooks())

    const cards = await screen.findAllByRole('listitem')
    expect(within(cards[0]).getByText(/2 houses/)).toBeTruthy()
    expect(within(cards[0]).getByText('142,500')).toBeTruthy()
    expect(within(cards[1]).getByText(/7 trades/)).toBeTruthy()
    expect(within(cards[1]).getByText('88,120')).toBeTruthy()
    expect(within(cards[2]).getByText(/3 people/)).toBeTruthy()
    expect(within(cards[2]).getByText('34,125')).toBeTruthy()
    expect(within(cards[3]).getByText('65,400')).toBeTruthy()
  })

  it('says one house rather than one houses, because a card is read out loud', async () => {
    renderWith(theBooks({ houses: { count: 1, goneOutPaisa: 100_000_00 } }))

    const cards = await screen.findAllByRole('listitem')
    expect(within(cards[0]).getByText(/1 house\b/)).toBeTruthy()
    expect(within(cards[0]).queryByText(/1 houses/)).toBeNull()
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
  const happening = {
    goneOutPaisa: 199_384_52,
    comeIn: { ownMoneyPaisa: 65_400_00 },
    whereItWent: [{}, {}, {}],
    thisMonth: { paidOutPaisa: 88_120_00 },
    // Two houses whose spending sums to neither the ledger total above nor either house alone.
    houses: [{ goneOutPaisa: 100_000_00 }, { goneOutPaisa: 42_500_00 }],
  }
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
    expect(cards?.spending.ownMoneyPaisa).toBe(65_400_00)
    expect(cards?.houses.count).toBe(2)
  })

  it('keeps one span of time in one sentence', () => {
    const cards = whatTheBooksAnswer(happening, owed)

    // `Spending by category` counted this month's trades beside the whole ledger's spending: 3 trades against 199,384.52, which is every payment ever made. One card, two spans of time, and it reads exactly like a working card.
    expect(cards?.spending.trades).toBe(happening.whereItWent.length)
    expect(cards?.spending.thisMonthPaisa).toBe(happening.thisMonth.paidOutPaisa)
    expect(cards?.spending.thisMonthPaisa).not.toBe(happening.goneOutPaisa)

    // And the houses card is the one that says what has been spent altogether, summed from the houses it is about.
    expect(cards?.houses.goneOutPaisa).toBe(142_500_00)
  })
})
