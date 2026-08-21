// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { TheTwoSides } from './TheTwoKinds'
import { TheTwoKinds, initialsOf } from './TheTwoKinds'

afterEach(cleanup)

// Every figure different, so a column reading the wrong field cannot look like a working column.
function bothSides(over: Partial<TheTwoSides> = {}): TheTwoSides {
  return {
    owedPaisa: 763_701_00,
    inPaisa: 8_540_000_00,
    weOwe: [
      {
        personId: 'p3',
        name: 'The mason',
        phone: '0300-0000000',
        doing: 'Civil labour',
        billedPaisa: 883_701_00,
        paidPaisa: 120_000_00,
        outstandingPaisa: 763_701_00,
      },
    ],
    putIn: [
      { personId: 'p1', name: 'The one who started it', role: 'partner', inPaisa: 6_540_000_00 },
      { personId: 'p6', name: 'the buyer', role: 'client', inPaisa: 2_000_000_00 },
    ],
    ...over,
  }
}

async function renderWith(sides: TheTwoSides | null | undefined) {
  const root = createRootRoute({ component: () => <TheTwoKinds sides={sides} /> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)

  if (sides !== null) await screen.findByRole('status').catch(() => screen.findByText('Who we pay'))
}

describe('the two kinds of person', () => {
  it('draws them as two different shapes, because they are not the same ledger', async () => {
    await renderWith(bothSides())

    // A balance is read down a column against other balances; what a man has put in is read as a thing of its own.
    expect(await screen.findByText('Who we pay')).toBeTruthy()
    expect(screen.getByText('Who puts money in')).toBeTruthy()
    expect(screen.getByText('Trade or role')).toBeTruthy()

    // Twice on purpose: the column heading a desk reads, and the label that rides with the figure on a phone where there is no heading above it.
    expect(screen.getAllByText('Balance owed')).toHaveLength(2)
  })

  it('carries what is billed, what is paid and what is left, from one piece of arithmetic', async () => {
    await renderWith(bothSides())

    const row = (await screen.findAllByRole('listitem'))[0]

    expect(within(row).getByText('883,701')).toBeTruthy()
    expect(within(row).getByText('120,000')).toBeTruthy()
    expect(within(row).getByText('763,701')).toBeTruthy()
    expect(within(row).getByText('Civil labour')).toBeTruthy()
  })

  it('says what each heading is the sum of', async () => {
    await renderWith(bothSides())

    // Read off the heading rather than off the page: the owed total is also this one man's balance, and a body-wide search cannot tell a heading's sum from the row it is the sum of.
    const owed = (await screen.findByText('Who we pay')).closest('div')

    expect(owed, 'the heading is not in a row this can read its sum off').not.toBeNull()
    expect(within(owed ?? document.body).getByText(/owed/)).toBeTruthy()
    expect(within(owed ?? document.body).getByText('763,701')).toBeTruthy()

    expect(screen.getByText('8,540,000')).toBeTruthy()
    expect(screen.getByText(/received/)).toBeTruthy()
  })

  it('says a partner is a partner and a client is a client, in the two tinted planes', async () => {
    await renderWith(bothSides())

    expect(await screen.findByText('partner')).toBeTruthy()
    expect(screen.getByText('client')).toBeTruthy()
    expect(screen.getByText('partner').className).toContain('green')
    expect(screen.getByText('client').className).toContain('brass')
  })

  it('promises no proportion of a figure nothing holds', async () => {
    await renderWith(bothSides())
    await screen.findByText('Who puts money in')

    // His card carries a bar and `of X committed`. Nothing anywhere holds what anybody committed -- not on a person, not on a role, and not on any form in his own file.

    // Absent rather than empty: a `No commitment set` sentence promises that setting one is possible, and there is nowhere to set it. That is a feature he has not got, not a blank we left.
    expect(document.body.textContent).not.toMatch(/committed/i)
    expect(document.querySelectorAll('[data-bar]')).toHaveLength(0)
  })

  it('says what to do when neither side has anybody on it yet', async () => {
    await renderWith(bothSides({ weOwe: [], putIn: [], owedPaisa: 0, inPaisa: 0 }))

    expect(await screen.findByText(/Nobody has billed anything yet/)).toBeTruthy()
    expect(screen.getByText(/Nothing has come in yet/)).toBeTruthy()
  })

  it('keeps the two unknowns apart', async () => {
    await renderWith(undefined)
    expect(await screen.findByRole('status', { name: 'Working out who is owed and who has put money in' })).toBeTruthy()

    cleanup()

    // A refusal draws nothing: the page around it has already said why, and two headings saying it again is saying it twice.
    await renderWith(null)
    expect(screen.queryByText('Who we pay')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens a person from either side, because a name is the way into that account', async () => {
    await renderWith(bothSides())

    const goes = (await screen.findAllByRole('link')).map((link) => link.getAttribute('href'))

    expect(goes).toContain('/people/p3')
    expect(goes).toContain('/people/p1')
  })
})

describe('the initials in front of a name', () => {
  it('are the first and the last, which is what a person is known by', () => {
    // Invented, and it has to stay invented: a plausible name written here to test initials is the same thing the workbooks' names are, and the digest guard caught the first one I reached for.
    expect(initialsOf('The steel supplier')).toBe('TS')
    expect(initialsOf('The one who started it')).toBe('TI')
  })

  it('are one letter for a single word, rather than half of nothing', () => {
    expect(initialsOf('Bricks')).toBe('B')
  })

  it('answer for a name with no letters in it at all, rather than an empty circle', () => {
    // A name is whatever somebody typed. `—` is a mark; an empty circle is a bug nobody can see.
    expect(initialsOf('')).toBe('—')
    expect(initialsOf('123')).toBe('—')
  })
})
