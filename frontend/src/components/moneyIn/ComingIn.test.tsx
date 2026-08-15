// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Account, NewReceipt, Person, Received } from './ComingIn'
import { ComingIn } from './ComingIn'

afterEach(cleanup)

const PEOPLE = [
  { _id: 'p1', name: 'The one it is built for' },
  { _id: 'p2', name: 'The partner' },
] as Array<Person>

const ACCOUNTS = [{ _id: 'b1', label: 'Second account' }] as Array<Account>

const ALREADY: Array<Received> = [
  { _id: 'm1', day: '2025-10-20', amountPaisa: 250_000_000, fromName: 'The one it is built for', why: 'clientPayment' },
  { _id: 'm2', day: '2025-08-01', amountPaisa: 200_000_000, fromName: 'The partner', why: 'partnerMoney' },
]

function renderWith(over: Partial<Parameters<typeof ComingIn>[0]> = {}) {
  const onPutIn = vi.fn<(receipt: NewReceipt) => Promise<void>>(() => Promise.resolve())

  const root = createRootRoute({
    component: () => (
      <ComingIn
        siteName="1-A, Phase 0"
        received={ALREADY}
        people={PEOPLE}
        accounts={ACCOUNTS}
        saving={false}
        refusal={null}
        onPutIn={onPutIn}
        {...over}
      />
    ),
  })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)

  return { onPutIn }
}

describe('money coming in', () => {
  it('lists what has already come in, with what it was and who it came from', async () => {
    renderWith()

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('The one it is built for')).toBeTruthy()
    expect(within(rows[0]).getByText('2,500,000')).toBeTruthy()
    // The words somebody would say, not the value underneath.
    expect(within(rows[0]).getByText(/The client/)).toBeTruthy()
    expect(within(rows[1]).getByText(/A partner/)).toBeTruthy()
  })

  it('says nothing has come in yet rather than showing an empty space', async () => {
    renderWith({ received: [] })
    await screen.findByLabelText('How much')

    expect(screen.getByText('Nothing has come in on this house yet.')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('takes a receipt, with what it is asked at the time', async () => {
    const { onPutIn } = renderWith({ received: [] })
    await screen.findByLabelText('How much')

    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '2500000' } })
    fireEvent.change(screen.getByLabelText('Who it came from'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('radio', { name: 'The house sold' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(onPutIn).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '2,500,000', fromId: 'p1', why: 'sale', method: 'cash' })
      )
    })
  })

  it('asks a cheque for its number and an account, and cash for neither', async () => {
    renderWith({ received: [] })
    await screen.findByLabelText('How much')

    // A transfer is what the form opens on, and it lands somewhere.
    expect(screen.getByLabelText('Which account it landed in')).toBeTruthy()
    expect(screen.queryByLabelText('Cheque number')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'Cheque' }))
    expect(screen.getByLabelText('Cheque number')).toBeTruthy()
    expect(screen.getByLabelText('Which account it landed in')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    expect(screen.queryByLabelText('Cheque number')).toBeNull()
    expect(screen.queryByLabelText('Which account it landed in')).toBeNull()
  })

  it('says what is missing beside the question, once the eye has left it', async () => {
    renderWith({ received: [] })
    await screen.findByLabelText('Who it came from')

    fireEvent.focus(screen.getByLabelText('Who it came from'))
    fireEvent.blur(screen.getByLabelText('Who it came from'))

    expect(screen.getByRole('alert').textContent).toBe('Say who this came from.')
  })

  it('groups the amount with commas as it is typed', async () => {
    renderWith({ received: [] })
    await screen.findByLabelText('How much')

    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '2500000' } })

    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('2,500,000')
  })

  it('shows the refusal the server sent, in its own words', async () => {
    renderWith({ received: [], refusal: 'Add the cheque number.' })
    await screen.findByLabelText('How much')

    expect(screen.getByRole('alert').textContent).toBe('Add the cheque number.')
  })

  it('says it is still looking while the answer is on its way, and nothing for a house that is not there', async () => {
    renderWith({ received: undefined })
    expect(await screen.findByText('Looking…')).toBeTruthy()

    cleanup()
    renderWith({ received: null })
    await screen.findByLabelText('How much')
    expect(screen.queryByText('Looking…')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('lets every choice be found by what is written on it', async () => {
    // A row of choices inside a `<label>` gives its first button the label's own words as its name: "How it came How it came", which is what a screen reader says and what nothing can find. The first of each row is the one that breaks, so both are checked.
    renderWith({ received: [] })
    await screen.findByLabelText('How much')

    expect(screen.getByRole('radio', { name: 'Cheque' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'A partner put it in' })).toBeTruthy()
  })

  it('says nothing technical anywhere on it', async () => {
    renderWith()
    await screen.findAllByRole('listitem')

    expect(document.body.textContent).not.toMatch(/record|entity|paisa|query|database|partnerMoney|clientPayment/i)
  })
})
