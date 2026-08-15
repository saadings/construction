// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NOT_ON_THE_LIST } from '../form/Pick'
import { WhoWasPaid, whoIsShown, whoWasMeant } from './WhoWasPaid'

afterEach(cleanup)

const PEOPLE = [
  { _id: 'p1', name: 'A mason' },
  { _id: 'p2', name: 'A steel supplier' },
]

function renderIt(who = { paidToId: '', newPerson: '' }, onChange = vi.fn()) {
  render(<WhoWasPaid who={who} people={PEOPLE} onChange={onChange} />)

  return { onChange }
}

describe('what one answer means', () => {
  it('takes a name already on the list as that person, however it was spelt', () => {
    // The guarantee #82 closed on the server, held here too: a typed name that matches somebody must never make a second row, because two rows for one man split his money across both.
    expect(whoWasMeant({ _id: NOT_ON_THE_LIST, name: 'A mason' }, PEOPLE)).toEqual({ paidToId: 'p1', newPerson: '' })
    expect(whoWasMeant({ _id: NOT_ON_THE_LIST, name: '  a   MASON ' }, PEOPLE)).toEqual({
      paidToId: 'p1',
      newPerson: '',
    })
  })

  it('takes a name nobody has as the name it is', () => {
    expect(whoWasMeant({ _id: NOT_ON_THE_LIST, name: 'A hardware shop' }, PEOPLE)).toEqual({
      paidToId: '',
      newPerson: 'A hardware shop',
    })
  })

  it('takes somebody picked as the person picked', () => {
    expect(whoWasMeant({ _id: 'p2', name: 'A steel supplier' }, PEOPLE)).toEqual({ paidToId: 'p2', newPerson: '' })
  })

  it('takes nothing as nothing, so clearing the box clears the answer', () => {
    // Without this, correcting a name leaves the payment pointing at whoever was picked before it while the box says somebody else.
    expect(whoWasMeant(null, PEOPLE)).toEqual({ paidToId: '', newPerson: '' })
  })

  it('shows the person rather than the id he is stored under', () => {
    expect(whoIsShown({ paidToId: 'p2', newPerson: '' }, PEOPLE)).toEqual({ _id: 'p2', name: 'A steel supplier' })
    expect(whoIsShown({ paidToId: '', newPerson: 'A hardware shop' }, PEOPLE)).toEqual({
      _id: NOT_ON_THE_LIST,
      name: 'A hardware shop',
    })
    expect(whoIsShown({ paidToId: '', newPerson: '' }, PEOPLE)).toBeNull()
  })
})

describe('answering who was paid', () => {
  it('is one place, and nothing the browser draws', () => {
    // A `<select>` and a `<datalist>` are both drawn by the browser in its own colours, which is what he sent a screenshot of. Neither is on this screen any more.
    renderIt()

    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('datalist')).toBeNull()
    expect(screen.queryByLabelText('Or a name')).toBeNull()
  })

  it('offers everybody on the list once it is opened', async () => {
    const user = userEvent.setup()
    renderIt()

    await user.click(screen.getByRole('combobox'))

    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['A mason', 'A steel supplier'])
  })

  it('offers to use a name nobody has, which is the whole of what he asked for', async () => {
    const user = userEvent.setup()
    const { onChange } = renderIt()

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'A hardware shop')
    await user.click(screen.getByRole('button', { name: 'Use “A hardware shop”' }))

    expect(onChange).toHaveBeenLastCalledWith({ paidToId: '', newPerson: 'A hardware shop' })
  })

  it('offers it beside the matches too, not only when nothing matches', async () => {
    // He may type the beginning of a name already on the list. Hiding the offer then is what would send him looking for a second box again.
    const user = userEvent.setup()
    renderIt()

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'A mas')

    expect(screen.getByRole('option', { name: 'A mason' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use “A mas”' })).toBeTruthy()
  })

  it('stops offering it once what was typed is a name already there', async () => {
    const user = userEvent.setup()
    renderIt()

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'A mason')

    expect(screen.queryByRole('button', { name: 'Use “A mason”' })).toBeNull()
  })

  it('says what will happen to a name nobody has, rather than warning about it', () => {
    // The ledger has no one-off: a payment has to point at somebody. Saying so is more use than calling it a name used once, which was never true.
    renderIt({ paidToId: '', newPerson: 'A hardware shop' })

    expect(screen.getByText('Nobody on the list is called that. A hardware shop will be added.')).toBeTruthy()
  })

  it('says nothing of the sort about somebody already on the list', () => {
    renderIt({ paidToId: 'p1', newPerson: '' })

    expect(screen.queryByText(/will be added/)).toBeNull()
    expect(screen.getByText('Pick one, or type a name.')).toBeTruthy()
  })
})
