// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { chooseTheDay } from '../../testing/day'
import type { BillRow } from './ExtraWork'
import { ExtraWork, whatItComesTo } from './ExtraWork'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// The calendar opens on the month the control is holding, and the control starts on today. Frozen so "raised on the 1st of May" is a day this test can reach without paging, and so it is the same day on every machine and in every month.
const WHILE_THE_WALL_WAS_BEING_BILLED = new Date(2026, 4, 12, 11, 0)

const ONE_BILL: Array<BillRow> = [
  {
    _id: 'b1',
    raisedOn: '2026-05-19',
    description: 'Extra retaining wall at the back',
    totalPaisa: 164_010_00,
    lines: [
      {
        _id: 'l1',
        description: 'Brickwork',
        working: "39.75' x 0.375' x 11'",
        quantity: 164.01,
        unit: 'cft',
        amountPaisa: 164_010_00,
      },
    ],
  },
]

function renderIt(bills: Array<BillRow> = [], handlers = {}) {
  const all = {
    onRaise: vi.fn().mockResolvedValue(undefined),
    onTakeBack: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  }

  render(<ExtraWork bills={bills} {...all} />)

  return all
}

function typeALine(line: { what: string; working?: string; how: string; unit: string; rate: string }, at = 1) {
  fireEvent.change(screen.getByLabelText(`What it was on line ${at}`), { target: { value: line.what } })
  if (line.working !== undefined) {
    fireEvent.change(screen.getByLabelText(`Calculation on line ${at}`), { target: { value: line.working } })
  }
  fireEvent.change(screen.getByLabelText(`Amount on line ${at}`), { target: { value: line.how } })
  fireEvent.change(screen.getByLabelText(`Measured in on line ${at}`), { target: { value: line.unit } })
  fireEvent.change(screen.getByLabelText(`Rate on line ${at}`), { target: { value: line.rate } })
}

describe('billing work that was outside the contract', () => {
  it('raises a bill with its lines, keeping the working exactly as it was measured', async () => {
    // `LESS EXTRA WORK` was one figure in the workbooks with nothing behind it. The working is what makes this one defensible, and re-deriving it would only ever disagree with the man who measured it.
    vi.setSystemTime(WHILE_THE_WALL_WAS_BEING_BILLED)
    const { onRaise } = renderIt()

    fireEvent.change(screen.getByLabelText('What the work was'), { target: { value: 'Extra retaining wall' } })
    await chooseTheDay(userEvent.setup(), 'Raised on', '2026-05-01')
    typeALine({ what: 'Brickwork', working: "39.75' x 0.375' x 11'", how: '164.01', unit: 'cft', rate: '100' })
    fireEvent.click(screen.getByRole('button', { name: 'Raise the bill' }))

    await waitFor(() => {
      expect(onRaise).toHaveBeenCalledWith({
        raisedOn: '2026-05-01',
        description: 'Extra retaining wall',
        lines: [
          {
            description: 'Brickwork',
            working: "39.75' x 0.375' x 11'",
            quantity: '164.01',
            unit: 'cft',
            ratePaisa: '100',
          },
        ],
      })
    })
  })

  it('sends no working at all when nobody wrote one, rather than an empty one', async () => {
    const { onRaise } = renderIt()

    fireEvent.change(screen.getByLabelText('What the work was'), { target: { value: 'Extra soil removed' } })
    typeALine({ what: 'Excavation', how: '40', unit: 'cft', rate: '50' })
    fireEvent.click(screen.getByRole('button', { name: 'Raise the bill' }))

    await waitFor(() => {
      expect(onRaise).toHaveBeenCalledWith(
        expect.objectContaining({ lines: [expect.objectContaining({ working: undefined })] })
      )
    })
  })

  it('takes as many lines as the work had, and lets one go again', () => {
    renderIt()

    // One line to start with, and it cannot be taken off: a bill with no lines is the figure with nothing behind it.
    expect(screen.queryByRole('button', { name: 'Take this line off' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }))
    expect(screen.getByLabelText('What it was on line 2')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Take this line off' })[1])
    expect(screen.queryByLabelText('What it was on line 2')).toBeNull()
  })

  it('adds up as it is typed, so nobody raises a bill without seeing the figure', () => {
    renderIt()

    typeALine({ what: 'Brickwork', how: '164.01', unit: 'cft', rate: '100' })

    // 164.01 cft at 100 rupees is 16,401 rupees. Rounded once, the way the line is billed.
    expect(screen.getByText(/Comes to/).textContent).toContain('16,401')
  })

  it('counts a line that is not a line yet as nothing, rather than stopping the total', () => {
    // Half a line typed is the normal state of a form. The total has to survive it.
    expect(whatItComesTo([{ description: 'Brickwork', working: '', quantity: '', unit: '', ratePaisa: '' }])).toBe(0)
    expect(
      whatItComesTo([
        { description: 'Brickwork', working: '', quantity: '10', unit: 'cft', ratePaisa: '100' },
        { description: '', working: '', quantity: '', unit: '', ratePaisa: '' },
      ])
    ).toBe(100_000)
  })

  it('shows every line of a bill already raised, with its working', () => {
    renderIt(ONE_BILL)

    const raised = within(screen.getByRole('list', { name: 'Bills already raised' })).getByRole('listitem')
    expect(within(raised).getByText('Brickwork')).toBeTruthy()
    expect(within(raised).getByText("39.75' x 0.375' x 11'")).toBeTruthy()
    // The day first and the month second, on a day past the twelfth so the two orders cannot both be read into it.
    expect(within(raised).getByText('Raised 19/05/2026')).toBeTruthy()
  })

  it('takes a bill back, which is what a client disagreeing about extra work needs', async () => {
    const { onTakeBack } = renderIt(ONE_BILL)

    // Two taps now: `Take it back` was soft enough to be its own warning and `Remove` is not, so this asks first.
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(onTakeBack).toHaveBeenCalledWith('b1')
    })
  })

  it('says what the server said when a bill will not go in', async () => {
    renderIt([], { onRaise: vi.fn().mockRejectedValue(new ConvexError('Put in at least one line of what was done.')) })

    fireEvent.change(screen.getByLabelText('What the work was'), { target: { value: 'Extra work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Raise the bill' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Put in at least one line of what was done.')
  })

  it('says what the server said when one will not come back out', async () => {
    renderIt(ONE_BILL, { onTakeBack: vi.fn().mockRejectedValue(new ConvexError('That bill is not on this house.')) })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect((await screen.findByRole('alert')).textContent).toBe('That bill is not on this house.')
  })

  it('starts empty again once a bill has gone in, and does not turn red doing it', async () => {
    renderIt()

    fireEvent.change(screen.getByLabelText('What the work was'), { target: { value: 'Extra retaining wall' } })
    typeALine({ what: 'Brickwork', how: '164.01', unit: 'cft', rate: '100' })
    fireEvent.blur(screen.getByLabelText('Rate on line 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Raise the bill' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('What the work was').value).toBe('')
    })
    expect(screen.getByLabelText<HTMLInputElement>('Rate on line 1').value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
