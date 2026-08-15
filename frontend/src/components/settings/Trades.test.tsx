// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TradeRow } from './Trades'
import { Trades } from './Trades'

afterEach(cleanup)

const THREE: Array<TradeRow> = [
  { _id: 't1', name: 'Civil labour', countsAsBuildingCost: true },
  { _id: 't2', name: 'Cement', countsAsBuildingCost: true },
  { _id: 't3', name: 'Plot purchase', countsAsBuildingCost: false },
]

function renderIt(trades: Array<TradeRow> | null | undefined = THREE, handlers = {}) {
  const all = {
    onAdd: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn().mockResolvedValue(undefined),
    onTakeOff: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  }

  render(<Trades trades={trades} {...all} />)

  return all
}

function theRowFor(name: string) {
  return screen.getAllByRole('listitem').filter((row) => row.textContent.includes(name))[0]
}

// The form is behind a button now: 47 things he has used to sit below a box for one he has not.
function openTheForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
}

describe('what for', () => {
  it('puts something else on the list, saying whether the house cost it', async () => {
    const { onAdd } = renderIt()
    openTheForm()

    fireEvent.change(screen.getByLabelText('Something else it is spent on'), { target: { value: 'Scaffolding' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the list' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: 'Scaffolding', countsAsBuildingCost: true })
    })
  })

  it('asks in words he would use, not by the name of the field', async () => {
    // `countsAsBuildingCost` decides what a house cost. Buying the land is money spent and is not building, and a tick box saying "counts as building cost" is the app talking to itself.
    const { onAdd } = renderIt()
    openTheForm()

    fireEvent.change(screen.getByLabelText('Something else it is spent on'), { target: { value: 'Society dues' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Land, taxes and commission' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the list' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: 'Society dues', countsAsBuildingCost: false })
    })
    expect(document.body.textContent).not.toMatch(/countsAsBuildingCost/)
  })

  it('groups by side, so the few that are not building cost are read without reading the rest', () => {
    // Three of forty-seven are land. On a list with a mark per row you read forty-seven to find a wrong one; here you read three.
    renderIt()

    const house = screen.getByRole('list', { name: 'Part of what the house cost' })
    const land = screen.getByRole('list', { name: 'Land, taxes and commission' })

    expect(within(house).getAllByRole('listitem')).toHaveLength(2)
    expect(within(land).getAllByRole('listitem')).toHaveLength(1)
    expect(within(land).getByText('Plot purchase')).toBeTruthy()
  })

  it('says how many are on each side, which is the question he has about this list', () => {
    renderIt()

    expect(screen.getByText(/Part of what the house cost · 2/)).toBeTruthy()
    expect(screen.getByText(/Land, taxes and commission · 1/)).toBeTruthy()
  })

  it('is named after the field that picks from it, which is where he went looking', () => {
    // He was on the day sheet looking at `WHAT FOR` and could not find this screen, because it was called "what money is spent on" -- true, and not the words in front of him.
    renderIt()

    expect(screen.getByRole('heading', { name: 'What for' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('What money is spent on')
  })

  it('shows the list before the form, rather than a box for one he has not above the ones he has', () => {
    renderIt()

    expect(screen.queryByLabelText('Something else it is spent on')).toBeNull()

    openTheForm()
    expect(screen.getByLabelText('Something else it is spent on')).toBeTruthy()
  })

  it('corrects a name and what it is for together, because they are the two things a trade is', async () => {
    const { onEdit } = renderIt()

    fireEvent.click(within(theRowFor('Cement')).getByRole('button', { name: 'Change' }))
    fireEvent.change(screen.getByLabelText('What Cement is'), { target: { value: 'Cement and lime' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save it' }))

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith('t2', { name: 'Cement and lime', countsAsBuildingCost: true })
    })
  })

  it('gives back what was there when a correction is abandoned', () => {
    const { onEdit } = renderIt()

    fireEvent.click(within(theRowFor('Cement')).getByRole('button', { name: 'Change' }))
    fireEvent.change(screen.getByLabelText('What Cement is'), { target: { value: 'Something else entirely' } })
    fireEvent.click(screen.getByRole('button', { name: 'Never mind' }))

    expect(theRowFor('Cement').textContent).toContain('Cement')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('takes one off the list, which is not the same as deleting it', async () => {
    const { onTakeOff } = renderIt()

    fireEvent.click(within(theRowFor('Cement')).getByRole('button', { name: 'Change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take it off the list' }))

    await waitFor(() => {
      expect(onTakeOff).toHaveBeenCalledWith('t2')
    })
  })

  it('says what the server said, and keeps what was being corrected', async () => {
    renderIt(THREE, { onEdit: vi.fn().mockRejectedValue({ data: 'Civil labour is already on the list.' }) })

    fireEvent.click(within(theRowFor('Cement')).getByRole('button', { name: 'Change' }))
    fireEvent.change(screen.getByLabelText('What Cement is'), { target: { value: 'Civil labour' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save it' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Civil labour is already on the list.')
    expect(screen.getByLabelText<HTMLInputElement>('What Cement is').value).toBe('Civil labour')
  })

  it('closes the form once one has gone on, and leaves it open with what was typed when it did not', async () => {
    renderIt()
    openTheForm()

    fireEvent.change(screen.getByLabelText('Something else it is spent on'), { target: { value: 'Scaffolding' } })
    fireEvent.blur(screen.getByLabelText('Something else it is spent on'))
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the list' }))

    await waitFor(() => {
      expect(screen.queryByLabelText('Something else it is spent on')).toBeNull()
    })
    expect(screen.queryByRole('alert')).toBeNull()

    cleanup()
    renderIt(THREE, { onAdd: vi.fn().mockRejectedValue({ data: 'Scaffolding is already on the list.' }) })
    openTheForm()

    fireEvent.change(screen.getByLabelText('Something else it is spent on'), { target: { value: 'Scaffolding' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the list' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Scaffolding is already on the list.')
    expect(screen.getByLabelText<HTMLInputElement>('Something else it is spent on').value).toBe('Scaffolding')
  })

  it('shows the shape of the list while it is coming, and says so when it does not come', () => {
    // Rendered without going through `renderIt`, because passing `undefined` to a parameter with a default is how you get the default -- which is the list, which is the opposite of what this asks.
    render(<Trades trades={undefined} onAdd={vi.fn()} onEdit={vi.fn()} onTakeOff={vi.fn()} />)
    expect(screen.getByRole('status', { name: 'Getting what a day sheet picks from' })).toBeTruthy()

    cleanup()
    renderIt(null)
    expect(screen.getByText(/The list did not come back/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
