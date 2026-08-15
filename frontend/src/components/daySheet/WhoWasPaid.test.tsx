// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('answering who was paid', () => {
  it('is one place, so nobody has to decide which box they mean first', () => {
    // It was a picker with a name field underneath it, and Nauman said "this is not good UX" about exactly that. Two controls for one question makes an implementation detail into a decision.
    renderIt()

    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryByLabelText('Or a name')).toBeNull()
  })

  it('offers everybody on the list to be picked from as it is typed', () => {
    renderIt()

    const offered = [...document.querySelectorAll('datalist option')].map((one) => one.getAttribute('value'))
    expect(offered).toEqual(['A mason', 'A steel supplier'])
  })

  it('takes a name already on the list as that person, however it was spelt', () => {
    // Typed rather than picked is still the same man. Anything else puts a second row under one name, which splits his money across both.
    expect(whoWasMeant('A mason', PEOPLE)).toEqual({ paidToId: 'p1', newPerson: '' })
    expect(whoWasMeant('  a   MASON ', PEOPLE)).toEqual({ paidToId: 'p1', newPerson: '' })
  })

  it('takes a name nobody has as the name it is', () => {
    expect(whoWasMeant('A hardware shop', PEOPLE)).toEqual({ paidToId: '', newPerson: 'A hardware shop' })
  })

  it('says what will happen to a name nobody has, rather than warning about it', () => {
    // The ledger has no one-off: a payment has to point at somebody. Saying so is more use than calling it a name used once, which was never true.
    renderIt({ paidToId: '', newPerson: 'A hardware shop' })

    expect(screen.getByText('Nobody on the list is called that. A hardware shop will be added.')).toBeTruthy()
  })

  it('says nothing of the sort about somebody already on the list', () => {
    renderIt({ paidToId: 'p1', newPerson: '' })

    expect(screen.getByLabelText<HTMLInputElement>('Who was paid').value).toBe('A mason')
    expect(screen.queryByText(/will be added/)).toBeNull()
  })

  it('shows the person picked rather than the id he is stored under', () => {
    expect(whoIsShown({ paidToId: 'p2', newPerson: '' }, PEOPLE)).toBe('A steel supplier')
    expect(whoIsShown({ paidToId: '', newPerson: 'A hardware shop' }, PEOPLE)).toBe('A hardware shop')
    expect(whoIsShown({ paidToId: '', newPerson: '' }, PEOPLE)).toBe('')
  })

  it('hands back one answer for one question, whichever it turned out to be', () => {
    const { onChange } = renderIt()

    fireEvent.change(screen.getByLabelText('Who was paid'), { target: { value: 'A steel supplier' } })
    expect(onChange).toHaveBeenLastCalledWith({ paidToId: 'p2', newPerson: '' })

    fireEvent.change(screen.getByLabelText('Who was paid'), { target: { value: 'A hardware shop' } })
    expect(onChange).toHaveBeenLastCalledWith({ paidToId: '', newPerson: 'A hardware shop' })
  })

  it('lets go of a person when his name is typed over', () => {
    // Without this, correcting a name leaves the payment pointing at whoever was picked before it and the box saying somebody else.
    const { onChange } = renderIt({ paidToId: 'p1', newPerson: '' })

    fireEvent.change(screen.getByLabelText('Who was paid'), { target: { value: 'A mas' } })

    expect(onChange).toHaveBeenLastCalledWith({ paidToId: '', newPerson: 'A mas' })
  })
})
