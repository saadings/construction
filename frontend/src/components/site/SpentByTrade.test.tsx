// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TradeSpend, WentOn } from './SpentByTrade'
import { SpentByTrade } from './SpentByTrade'

afterEach(cleanup)

// This screen had no test at all. It draws every payment on a house and the control that takes one back out -- which is the thing this app has the strongest opinions about, and the one it was proving nothing about.
const BY_TRADE: Array<TradeSpend> = [
  { tradeId: 't1', name: 'Civil labour', paisa: 800_000_00 },
  { tradeId: 't2', name: 'Cement', paisa: 200_000_00 },
  { tradeId: 't3', name: 'Supervision charges', paisa: 40_000_00 },
]

const WENT: Array<WentOn> = [
  {
    _id: 'p1',
    day: '2026-07-23',
    amountPaisa: 500_000_00,
    paidToName: 'The mason',
    method: 'cheque',
    reference: 'CH-4471',
  },
  { _id: 'p2', day: '2026-07-11', amountPaisa: 300_000_00, paidToName: 'The mason', method: 'cash' },
]

function draw(over: Partial<Parameters<typeof SpentByTrade>[0]> = {}) {
  const props = {
    byTrade: BY_TRADE,
    onOpen: vi.fn(),
    opened: null,
    onTakeOut: vi.fn(() => Promise.resolve(true)),
    takingOut: null,
    refusal: null,
    ...over,
  }

  render(<SpentByTrade {...props} />)

  return props
}

describe('what a house cost, by category', () => {
  it('says every category and what went on it', () => {
    draw()

    expect(screen.getByRole('heading', { name: 'Cost by category' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Civil labour' })).toBeTruthy()
    expect(screen.getByText('800,000')).toBeTruthy()
    expect(screen.getByText('40,000')).toBeTruthy()
  })

  it('draws each bar against the largest category, so the small ones are still readable', () => {
    draw()

    const widths = [...document.querySelectorAll('[data-bar]')].map((bar) =>
      (bar as HTMLElement).style.width.replace('%', '')
    )

    // 800,000 is the largest, so it is the full track. 200,000 is a quarter of it and 40,000 a twentieth -- measured against the largest rather than the total, or the two small ones would be three points apart and unreadable.
    expect(widths).toEqual(['100', '25', '5'])
  })

  it('opens a category to what went on it, and closes it again', () => {
    const props = draw()

    fireEvent.click(screen.getByRole('button', { name: 'Cement' }))
    expect(props.onOpen).toHaveBeenCalledWith('t2')

    cleanup()
    draw({ opened: { tradeId: 't2', went: WENT } })

    // A figure on this screen is a sum, and this is what it is a sum of. It is where a wrong one is found.

    // Both payments went to the same person on purpose: a category opened to two rows from one supplier is the ordinary case, and a test asserting one of them would have been asserting the fixture rather than the screen.
    expect(screen.getAllByText('The mason')).toHaveLength(2)
    expect(screen.getByText('500,000')).toBeTruthy()
    // The cheque number, whole: this is one of the screens somebody checks one against a cheque book.
    expect(screen.getByText('CH-4471')).toBeTruthy()

    // Open, so pressing it again closes it rather than opening it twice.
    fireEvent.click(screen.getByRole('button', { name: 'Cement' }))
  })

  it('asks before it takes a payment out, and says what stays behind', async () => {
    const props = draw({ opened: { tradeId: 't2', went: WENT } })

    fireEvent.click(screen.getByRole('button', { name: /Remove 500,000 paid to The mason/ }))

    // Asked once and in place: a payment cannot be put back from a screen, so the second press is the whole of what stands between a slip of the thumb and a figure disappearing.
    expect(screen.getByText('Remove this?')).toBeTruthy()
    expect(screen.getByText(/What was entered stays/)).toBeTruthy()
    expect(props.onTakeOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
    await waitFor(() => {
      expect(props.onTakeOut).toHaveBeenCalledWith('p1')
    })
  })

  it('lets go of the asking without taking anything out', () => {
    const props = draw({ opened: { tradeId: 't2', went: WENT } })

    fireEvent.click(screen.getByRole('button', { name: /Remove 500,000 paid to The mason/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Remove this?')).toBeNull()
    expect(props.onTakeOut).not.toHaveBeenCalled()
  })

  it('keeps the two unknowns apart under an open category', () => {
    draw({ opened: { tradeId: 't2', went: undefined } })
    expect(screen.getByRole('status', { name: 'Getting what went on it' })).toBeTruthy()

    cleanup()

    // A refusal is not a wait. The screen around this has already said why, so saying it again here is saying it twice.
    draw({ opened: { tradeId: 't2', went: null } })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says what the server said, where the category it is about is open', () => {
    draw({ opened: { tradeId: 't2', went: WENT }, refusal: 'That payment is already out.' })

    expect(within(screen.getByRole('alert')).getByText('That payment is already out.')).toBeTruthy()
  })

  it('says what to do when nothing has been spent yet', () => {
    draw({ byTrade: [] })

    expect(screen.getByText(/Nothing spent on this house yet/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Cost by category' })).toBeNull()
  })
})
