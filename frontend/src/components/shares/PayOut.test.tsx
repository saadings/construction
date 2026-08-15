// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick } from '../../testing/pick'
import type { Account, NewPayout, PaidOut, Partner } from './PayOut'
import { PayOut } from './PayOut'

afterEach(cleanup)

const PARTNERS: Array<Partner> = [
  { _id: 'p1', name: 'The one who started it' },
  { _id: 'p2', name: 'The one who came in later' },
]

const ACCOUNTS: Array<Account> = [
  { _id: 'b1', label: 'Bank 0000' },
  { _id: 'b2', label: 'Bank 1111' },
]

const GONE_BACK: Array<PaidOut> = [
  {
    _id: 'o1',
    day: '2026-07-04',
    amountPaisa: 2_000_000,
    personName: 'The one who started it',
    method: 'cheque',
    reference: '774411',
  },
]

function renderWith(over: Partial<Parameters<typeof PayOut>[0]> = {}) {
  const onPayOut = vi.fn<(payout: NewPayout) => Promise<void>>(() => Promise.resolve())
  const onTakeBack = vi.fn<(payoutId: string) => Promise<void>>(() => Promise.resolve())

  render(
    <PayOut
      partners={PARTNERS}
      paidOut={GONE_BACK}
      accounts={ACCOUNTS}
      onPayOut={onPayOut}
      onTakeBack={onTakeBack}
      {...over}
    />
  )

  return { onPayOut, onTakeBack }
}

describe('writing down what has gone back to a partner', () => {
  it('sends what was typed, so a partner can be paid from a screen at all', async () => {
    // The whole of the defect this screen closes: `profitPayouts.record` had seven call-sites and every one of them was a test. In production nobody could reach it, `paidPaisa` was zero for good, and the partners' table said each of them was owed the whole of his share.
    const user = userEvent.setup()
    const { onPayOut } = renderWith()

    await pick(user, 'Who it went to', 'The one who came in later')
    fireEvent.change(screen.getByLabelText('Which day'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '150000' } })
    fireEvent.change(screen.getByLabelText('Cheque number'), { target: { value: '882200' } })

    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(onPayOut).toHaveBeenCalledWith({
        personId: 'p2',
        day: '2026-08-01',
        amount: '150,000',
        method: 'cheque',
        reference: '882200',
        bankAccountId: undefined,
        note: undefined,
      })
    })
  })

  it('sends the id of whoever was picked, rather than his name', async () => {
    // Two partners called the same thing is not a strange case in a family building a house, and a screen that handed back a name would pay the wrong one.
    const user = userEvent.setup()
    const { onPayOut } = renderWith({
      partners: [
        { _id: 'p1', name: 'Muhammad' },
        { _id: 'p2', name: 'Muhammad' },
      ],
    })

    await user.click(screen.getByRole('combobox', { name: 'Who it went to' }))
    const both = await screen.findAllByRole('option', { name: 'Muhammad' })
    await user.click(both[1])

    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(onPayOut.mock.calls[0]?.[0].personId).toBe('p2')
    })
  })

  it('asks which account it left, once the way it went needs one', async () => {
    const user = userEvent.setup()
    const { onPayOut } = renderWith()

    // Cash asks nothing further; a transfer has to have come out of somewhere.
    fireEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    expect(screen.queryByRole('combobox', { name: 'Which account it left' })).toBeNull()
    expect(screen.queryByLabelText('Cheque number')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }))

    await pick(user, 'Who it went to', 'The one who started it')
    await pick(user, 'Which account it left', 'Bank 1111')
    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '5000' } })

    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(onPayOut.mock.calls[0]?.[0]).toMatchObject({
        method: 'transfer',
        bankAccountId: 'b2',
        reference: undefined,
      })
    })
  })

  it('says the accounts are still coming, rather than showing the same nothing as a partnership that banks nowhere', () => {
    // `accounts ?? []` here would answer both with an empty list, and the way out of that is to type nothing and wonder.
    renderWith({ accounts: undefined })
    fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }))

    expect(screen.getByRole('combobox', { name: 'Which account it left' }).getAttribute('placeholder')).toBe(
      'Still getting the accounts…'
    )

    cleanup()
    renderWith({ accounts: [] })
    fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }))

    expect(screen.getByRole('combobox', { name: 'Which account it left' }).getAttribute('placeholder')).toBe(
      'No accounts written down yet'
    )
  })

  it('empties the boxes once it has gone in, and keeps whoever it went to', async () => {
    // Partners are paid in a run out of one cheque book, so the name stays and the figure does not.
    const user = userEvent.setup()
    renderWith()

    await pick(user, 'Who it went to', 'The one who started it')
    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Cheque number'), { target: { value: '774412' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('')
    })
    expect(screen.getByLabelText<HTMLInputElement>('Cheque number').value).toBe('')
    expect(screen.getByRole('combobox', { name: 'Who it went to' }).getAttribute('value')).toBe(
      'The one who started it'
    )
  })

  it('leaves what was typed exactly where it was when the server refuses it', async () => {
    // The sentence under the button is about the figure still in the box. Emptying it leaves him reading a refusal against nothing, and typing the lot again to find out what he got wrong.
    const user = userEvent.setup()
    const refused = vi.fn(() =>
      Promise.reject(Object.assign(new Error('refused'), { data: 'That day is before the house started.' }))
    )

    renderWith({ onPayOut: refused })

    await pick(user, 'Who it went to', 'The one who started it')
    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Cheque number'), { target: { value: '774413' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'That day is before the house started.')
    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('5,000')
    expect(screen.getByLabelText<HTMLInputElement>('Cheque number').value).toBe('774413')
  })

  it('offers nobody to pay on a house nobody has a share of', () => {
    renderWith({ partners: [] })

    expect(screen.queryByRole('button', { name: 'Put it in' })).toBeNull()
    expect(screen.getByText(/Nobody has a share of this house yet/)).toBeTruthy()
  })
})

describe('what has already gone back to them', () => {
  it('lists each one with who had it, how it went and when', () => {
    renderWith()

    const row = screen.getByRole('listitem')
    expect(within(row).getByText('The one who started it')).toBeTruthy()
    expect(within(row).getByText('20,000')).toBeTruthy()
    expect(within(row).getByText(/Cheque · 2026-07-04 · 774411/)).toBeTruthy()
  })

  it('takes one back by its own id, so the right one goes', async () => {
    const { onTakeBack } = renderWith({
      paidOut: [
        // Two alike in everything a screen shows. Anything that found a row by what is written on it would take the wrong one.
        { ...GONE_BACK[0], _id: 'o1' },
        { ...GONE_BACK[0], _id: 'o2' },
      ],
    })

    const rows = screen.getAllByRole('listitem')
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Take it back' }))

    await waitFor(() => {
      expect(onTakeBack).toHaveBeenCalledWith('o2')
    })
  })

  it('says what the server refused a removal with, beside the one it was about', async () => {
    const refused = vi.fn(() =>
      Promise.reject(Object.assign(new Error('refused'), { data: 'That payment out is not on this house.' }))
    )
    renderWith({ onTakeBack: refused })

    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'That payment out is not on this house.')
  })

  it('tells a list still on its way apart from a house with nothing paid out on it', () => {
    renderWith({ paidOut: undefined })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText(/Nothing has gone back to anybody/)).toBeNull()

    cleanup()
    renderWith({ paidOut: [] })
    expect(screen.getByText(/Nothing has gone back to anybody on this house yet/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says nothing technical anywhere on it', () => {
    renderWith()

    expect(document.body.textContent).not.toMatch(/paisa|record|mutation|query|entity|database|null|undefined/i)
  })
})
