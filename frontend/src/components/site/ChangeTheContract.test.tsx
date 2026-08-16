// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChangeTheContract } from './ChangeTheContract'

afterEach(cleanup)

const AT_A_RATE = {
  priced: { how: 'ratePerSqft' as const, ratePerSqftPaisa: 550_000 },
  agreedAreaSqft: 2250,
}

function renderIt(contract = AT_A_RATE, handlers: Partial<Handlers> = {}) {
  const all: Handlers = {
    onMeasure: vi.fn().mockResolvedValue(undefined),
    onRevise: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  }

  render(<ChangeTheContract contract={contract} {...all} />)

  return all
}

type Handlers = {
  onMeasure: (sqft: string) => Promise<void>
  onRevise: (revision: { priced: unknown; agreedAreaSqft: string; note?: string }) => Promise<void>
  onCancel: () => Promise<void>
}

function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
}

describe('correcting a contract already agreed', () => {
  it('stays out of the way until it is asked for', () => {
    renderIt()

    expect(screen.queryByLabelText('Area measured')).toBeNull()

    open()

    expect(screen.getByLabelText('Area measured')).toBeTruthy()
  })

  it('puts a measurement in without touching what was agreed', async () => {
    // The agreed figure is what a disagreement is settled against, so measuring never rewrites it.
    const { onMeasure } = renderIt()
    open()

    fireEvent.change(screen.getByLabelText('Area measured'), { target: { value: '2310' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save measurement' }))

    await waitFor(() => {
      expect(onMeasure).toHaveBeenCalledWith('2,310')
    })
    // Still saying what was agreed, beside the box asking what was measured.
    expect(screen.getByText(/Agreed at 2,250 sq ft/)).toBeTruthy()
  })

  it('opens holding what the contract already says, so a correction is a correction', () => {
    renderIt()
    open()

    // 550,000 paisa is 5,500 rupees a square foot. A form that opened empty would read as a contract with nothing in it.
    expect(screen.getByLabelText<HTMLInputElement>('Rate per square foot').value).toBe('5,500')
    expect(screen.getByLabelText<HTMLInputElement>('Area agreed').value).toBe('2,250')
  })

  it('can turn a rate contract into an agreed price, which is the correction that matters', async () => {
    const { onRevise } = renderIt()
    open()

    fireEvent.click(screen.getByRole('radio', { name: 'One agreed price' }))
    fireEvent.change(screen.getByLabelText('Contract price'), { target: { value: '12500000' } })
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Rate typed wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onRevise).toHaveBeenCalledWith({
        priced: { how: 'lumpSum', totalPaisa: '12,500,000' },
        agreedAreaSqft: '2,250',
        note: 'Rate typed wrong',
      })
    })
  })

  it('asks twice before cancelling, because it takes the whole billing side off the house', async () => {
    const { onCancel } = renderIt()
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this contract' }))
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled()
    })
  })

  it('lets go of the second ask, so a misplaced press is not a cancelled contract', () => {
    const { onCancel } = renderIt()
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this contract' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(screen.queryByRole('button', { name: 'Yes, cancel it' })).toBeNull()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('says what the server said, on whichever of the three was pressed', async () => {
    renderIt(AT_A_RATE, {
      onMeasure: vi.fn().mockRejectedValue(new ConvexError('That contract is not on this house.')),
    })
    open()

    fireEvent.change(screen.getByLabelText('Area measured'), { target: { value: '2310' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save measurement' }))

    expect((await screen.findByRole('alert')).textContent).toBe('That contract is not on this house.')
  })

  it('says something rather than nothing when the server said nothing a person can read', async () => {
    renderIt(AT_A_RATE, { onCancel: vi.fn().mockRejectedValue(new Error('TypeError: failed to fetch')) })
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel this contract' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

    // Never the raw message: production replaces it, and what is left is "Server Error" under a heading about a contract.
    expect((await screen.findByRole('alert')).textContent).toBe('That did not go in. Try once more.')
  })
})
