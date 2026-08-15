// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AccountRow } from './BankAccounts'
import { BankAccounts } from './BankAccounts'

afterEach(cleanup)

const TWO: Array<AccountRow> = [
  { _id: 'a1', label: 'Bank 4417', lastFourDigits: '4417' },
  { _id: 'a2', label: 'Bank 9082', lastFourDigits: '9082' },
]

function renderIt(accounts: Array<AccountRow> | null | undefined = TWO, handlers = {}) {
  const all = {
    onAdd: vi.fn().mockResolvedValue(undefined),
    onTakeOff: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  }

  render(<BankAccounts accounts={accounts} {...all} />)

  return all
}

describe('the accounts money leaves', () => {
  it('sends only the last four figures, whatever was typed', async () => {
    // The whole number never leaves the device. There is nothing at the other end to store, to log or to leak.
    const { onAdd } = renderIt([])

    fireEvent.change(screen.getByLabelText('What you call it'), { target: { value: 'Bank 4417' } })
    fireEvent.change(screen.getByLabelText('The account number'), { target: { value: '0123-4567-8901-4417' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put the account in' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('Bank 4417', '4417')
    })
  })

  it('refuses a number that stopped half way, in different words from one left empty', () => {
    // A field not filled in and a hand that stopped are two different mistakes.
    renderIt([])

    fireEvent.change(screen.getByLabelText('The account number'), { target: { value: '12' } })
    fireEvent.blur(screen.getByLabelText('The account number'))

    expect(screen.getByRole('alert').textContent).toBe(
      'That is not enough of it. Put in the whole number, or its last four digits.'
    )
  })

  it('draws an account as it is stored, because there is no whole number anywhere to mask', () => {
    renderIt()

    const first = within(screen.getByRole('list', { name: 'Accounts money leaves' })).getAllByRole('listitem')[0]
    expect(first.textContent).toContain('••••4417')
    expect(first.textContent).not.toContain('0123')
  })

  it('takes one off, which is the thing that could be added and never removed', async () => {
    const { onTakeOff } = renderIt()

    fireEvent.click(screen.getAllByRole('button', { name: 'Take it off' })[1])

    await waitFor(() => {
      expect(onTakeOff).toHaveBeenCalledWith('a2')
    })
  })

  it('says what the server said when one will not come off', async () => {
    renderIt(TWO, { onTakeOff: vi.fn().mockRejectedValue({ data: 'That account is not on the list any more.' }) })

    fireEvent.click(screen.getAllByRole('button', { name: 'Take it off' })[0])

    expect((await screen.findByRole('alert')).textContent).toBe('That account is not on the list any more.')
  })

  it('says what to do when there are none, rather than showing an empty box', () => {
    renderIt([])

    expect(screen.getByText(/None yet/)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Accounts money leaves' })).toBeNull()
  })

  it('shows the shape of the list while it is coming, and says so when it does not come', () => {
    // Rendered without going through `renderIt`, because passing `undefined` to a parameter with a default is how you get the default -- which is the list, which is the opposite of what this asks.
    render(<BankAccounts accounts={undefined} onAdd={vi.fn()} onTakeOff={vi.fn()} />)
    expect(screen.getByRole('status', { name: 'Getting the accounts' })).toBeTruthy()

    cleanup()
    renderIt(null)
    expect(screen.getByText(/The accounts did not come back/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('starts empty again once one has gone in', async () => {
    renderIt([])

    fireEvent.change(screen.getByLabelText('What you call it'), { target: { value: 'Bank 4417' } })
    fireEvent.change(screen.getByLabelText('The account number'), { target: { value: '4417' } })
    fireEvent.blur(screen.getByLabelText('The account number'))
    fireEvent.click(screen.getByRole('button', { name: 'Put the account in' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('The account number').value).toBe('')
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
