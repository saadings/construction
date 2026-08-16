// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WentOn } from './SpentByTrade'
import { SpentByTrade } from './SpentByTrade'

afterEach(cleanup)

// The figures a client site shows are the ones pass 4 works out, so what is tested here is that the screen shows them rather than that the sums are right.

const cement = { tradeId: 't1', name: 'Cement', paisa: 859_280_00 }
const bricks = { tradeId: 't2', name: 'Bricks', paisa: 786_000_00 }

const WENT_ON_CEMENT: Array<WentOn> = [
  {
    _id: 'pay1',
    day: '2025-11-03',
    amountPaisa: 500_000_00,
    paidToName: 'The cement man',
    method: 'cheque',
    reference: '0184',
  },
  { _id: 'pay2', day: '2025-10-28', amountPaisa: 359_280_00, paidToName: 'A one-off', method: 'cash' },
]

function renderWith(over: Partial<Parameters<typeof SpentByTrade>[0]> = {}) {
  const onOpen = vi.fn<(tradeId: string | null) => void>()
  const onTakeOut = vi.fn<(paymentId: string) => Promise<boolean>>(() => Promise.resolve(true))

  const shown = render(
    <SpentByTrade
      byTrade={[cement, bricks]}
      onOpen={onOpen}
      opened={null}
      onTakeOut={onTakeOut}
      takingOut={null}
      refusal={null}
      {...over}
    />
  )

  return { onOpen, onTakeOut, ...shown }
}

describe('what a house was spent on', () => {
  it('reads every trade with its figure', () => {
    renderWith()

    expect(screen.getByText('Cement')).toBeTruthy()
    expect(screen.getByText('859,280')).toBeTruthy()
    expect(screen.getByText('Bricks')).toBeTruthy()
  })

  it('says so plainly when nothing has been spent', () => {
    renderWith({ byTrade: [] })

    expect(screen.getByText('Nothing spent on this house yet.')).toBeTruthy()
  })

  it('sets every figure in the face that makes a column read as a column', () => {
    // Without `tabular-nums` a column of amounts is a list of different-width strings, which is the whole reason the mono face is here.
    renderWith()

    for (const shown of ['859,280', '786,000']) {
      expect(screen.getByText(shown).className).toContain('font-mono')
      expect(screen.getByText(shown).className).toContain('tabular-nums')
    }
  })

  it('lets a wide table scroll inside itself rather than pushing the page sideways', () => {
    // A phone is narrower than this table. The page must not gain a horizontal scrollbar because of it.
    const { container } = renderWith()

    expect(container.querySelector('.overflow-x-auto')).not.toBeNull()
  })

  it('shows money going out in brass, which is what brass means everywhere', () => {
    renderWith({ byTrade: [cement] })

    expect(screen.getByText('859,280').className).toContain('text-brass')
  })
})

describe('the payments behind one figure', () => {
  it('asks for them when a trade is opened, and closes it when it is pressed again', () => {
    const { onOpen } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Cement' }))
    expect(onOpen).toHaveBeenCalledWith('t1')

    cleanup()
    const again = renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })
    fireEvent.click(screen.getByRole('button', { name: 'Cement' }))
    expect(again.onOpen).toHaveBeenCalledWith(null)
  })

  it('reads each one the way somebody would say it', () => {
    renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('The cement man')).toBeTruthy()
    expect(within(rows[0]).getByText('500,000')).toBeTruthy()
    // The words, not the value underneath.
    expect(within(rows[0]).getByText(/Cheque/)).toBeTruthy()
    expect(within(rows[0]).getByText(/0184/)).toBeTruthy()
    expect(within(rows[1]).getByText(/Cash/)).toBeTruthy()
  })

  it('puts up the shape of what is coming, and nothing for a trade that is not there', () => {
    renderWith({ opened: { tradeId: 't1', went: undefined } })
    expect(screen.getByRole('status', { name: 'Getting what went on it' })).toBeTruthy()

    cleanup()
    renderWith({ opened: { tradeId: 't1', went: null } })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('says nothing is left on a trade every payment has come off', () => {
    renderWith({ opened: { tradeId: 't1', went: [] } })

    expect(screen.getByText('Nothing on this one any more.')).toBeTruthy()
  })

  it('opens only the trade that was opened', () => {
    renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('Nothing on this one any more.')).toBeNull()
  })
})

describe('taking a wrong figure out', () => {
  it('asks before it does it, because a payment cannot be put back from a screen', async () => {
    const { onTakeOut } = renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    fireEvent.click(screen.getByRole('button', { name: 'Remove 500,000 paid to The cement man' }))
    expect(onTakeOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(onTakeOut).toHaveBeenCalledWith('pay1')
    })
  })

  it('says it is being hidden rather than erased, because that is what happens', () => {
    renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    fireEvent.click(screen.getByRole('button', { name: 'Remove 500,000 paid to The cement man' }))

    expect(screen.getByText('Remove this?')).toBeTruthy()
  })

  it('lets somebody change their mind without anything happening', () => {
    const { onTakeOut } = renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    fireEvent.click(screen.getByRole('button', { name: 'Remove 500,000 paid to The cement man' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onTakeOut).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remove 500,000 paid to The cement man' })).toBeTruthy()
  })

  it('asks about one payment at a time, not about all of them at once', () => {
    renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    fireEvent.click(screen.getByRole('button', { name: 'Remove 500,000 paid to The cement man' }))

    expect(screen.getAllByText('Remove this?')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Remove 359,280 paid to A one-off' })).toBeTruthy()
  })

  it('turns the one being taken out off while it is going, and leaves the others alone', () => {
    renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT }, takingOut: 'pay1' })

    fireEvent.click(screen.getByRole('button', { name: 'Remove 500,000 paid to The cement man' }))
    expect(screen.getByRole('button', { name: 'Removing…' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Remove 359,280 paid to A one-off' }))
    expect(screen.getByRole('button', { name: 'Yes, remove' }).hasAttribute('disabled')).toBe(false)
  })

  it('shows the refusal the server sent, in its own words', () => {
    // A removal that quietly does nothing is the worst of both: the figure stays and nobody is told why.
    renderWith({
      opened: { tradeId: 't1', went: WENT_ON_CEMENT },
      refusal: 'That payment is not on this site.',
    })

    expect(screen.getByRole('alert').textContent).toBe('That payment is not on this site.')
  })

  it('says nothing technical anywhere on it', () => {
    renderWith({ opened: { tradeId: 't1', went: WENT_ON_CEMENT } })

    expect(document.body.textContent).not.toMatch(/record|entity|paisa|query|database|payOrder|removed/i)
  })
})
