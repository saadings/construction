// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { chooseTheDay } from '../../testing/day'
import type { StageRow } from './Stages'
import { Stages } from './Stages'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// The calendar opens on the month the control is holding, and a stage's starts on today. Frozen so "billed on the 2nd of May" is a day this test can reach without paging, and so it is the same day on every machine and in every month.
const WHILE_THE_PLINTH_WAS_BEING_BILLED = new Date(2026, 4, 20, 11, 0)

const THREE: Array<StageRow> = [
  { _id: 'm1', description: 'On signing', percent: 20, amountPaisa: 250_000_00, billedOn: '2026-04-01' },
  { _id: 'm2', description: 'At plinth level', percent: 30, amountPaisa: 375_000_00 },
  { _id: 'm3', description: 'At grey structure', percent: 35, amountPaisa: 437_500_00 },
]

function renderIt(stages: Array<StageRow> = THREE, percentAgreed = 85, handlers = {}) {
  const all = {
    onAdd: vi.fn().mockResolvedValue(undefined),
    onBill: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  }

  render(<Stages stages={stages} percentAgreed={percentAgreed} {...all} />)

  return all
}

describe('the stages a contract is billed in', () => {
  it('puts a stage in as a share, and the figure against it follows the contract', async () => {
    const { onAdd } = renderIt()

    fireEvent.change(screen.getByLabelText('What the stage is'), { target: { value: 'At finishing' } })
    fireEvent.change(screen.getByLabelText('Share of it'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put the stage in' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ description: 'At finishing', percent: '15' })
    })
  })

  it('says where the stages have got to without adding the column up by hand', () => {
    // Never refused: a re-measurement or an unplanned stage leaves real contracts at eighty-five, and refusing those would refuse the truth. But nobody should have to work out that it is eighty-five.
    renderIt(THREE, 85)

    expect(screen.getByText('The stages come to 85%. 15% of the contract is not set out in any of them.')).toBeTruthy()
  })

  it('says so the other way round too, which is the one nobody expects', () => {
    renderIt(THREE, 105)

    expect(screen.getByText('The stages come to 105%, which is 5% more than the contract.')).toBeTruthy()
  })

  it('says nothing is left when nothing is', () => {
    renderIt(THREE, 100)

    expect(screen.getByText('The stages come to the whole contract.')).toBeTruthy()
  })

  it('bills a stage on the day it went out, not on the day it was typed in', async () => {
    // A bill sent last week and entered today is billed last week, or the ledger stops matching the paperwork.
    vi.setSystemTime(WHILE_THE_PLINTH_WAS_BEING_BILLED)
    const { onBill } = renderIt()

    await chooseTheDay(userEvent.setup(), 'When At plinth level was billed', '2026-05-02')
    fireEvent.click(screen.getAllByRole('button', { name: 'Bill it' })[0])

    await waitFor(() => {
      expect(onBill).toHaveBeenCalledWith('m2', '2026-05-02')
    })
  })

  it('offers to bill only what has not been billed, and says when the rest were', () => {
    renderIt()

    // Two of the three are unbilled, and the first is not one of them.
    expect(screen.getAllByRole('button', { name: 'Bill it' })).toHaveLength(2)
    expect(screen.getByText('Billed 2026-04-01')).toBeTruthy()

    // Asked the way the control really names itself, which is the label with the day it is holding on the end. Asked by the label alone it would find nothing whether the control were there or not, and an assertion that cannot fail is worse than none: the other two dates below are what proves this one is looking at anything.
    const asked = (label: string) => screen.queryAllByRole('button', { name: (name) => name.startsWith(`${label}: `) })

    expect(asked('When On signing was billed')).toEqual([])
    expect(asked('When At plinth level was billed')).toHaveLength(1)
    expect(asked('When At grey structure was billed')).toHaveLength(1)
  })

  it('says what the server said when a stage will not bill', async () => {
    // Without this the button turns off, turns back on, and nothing on the screen has changed.
    const { onBill } = renderIt(THREE, 85, {
      onBill: vi.fn().mockRejectedValue(new ConvexError('That stage has already been billed.')),
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Bill it' })[0])

    expect((await screen.findByRole('alert')).textContent).toBe('That stage has already been billed.')
    expect(onBill).toHaveBeenCalled()
  })

  it('says what to do when a contract has no stages, rather than showing an empty table', () => {
    renderIt([], 0)

    expect(screen.getByText(/No stages set out yet/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('does not turn red under a box nobody has touched once a stage has gone in', async () => {
    renderIt()

    fireEvent.change(screen.getByLabelText('Share of it'), { target: { value: '15' } })
    fireEvent.blur(screen.getByLabelText('Share of it'))
    fireEvent.change(screen.getByLabelText('What the stage is'), { target: { value: 'At finishing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put the stage in' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Share of it').value).toBe('')
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
