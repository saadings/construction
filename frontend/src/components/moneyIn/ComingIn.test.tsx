// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick, useTheName } from '../../testing/pick'
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
  const onPutIn = vi.fn<(arrivals: Array<NewReceipt>) => Promise<boolean>>(() => Promise.resolve(true))
  const onTakeBack = vi.fn<(moneyInId: string) => Promise<void>>(() => Promise.resolve())
  const onAddAccount = vi.fn<(label: string, lastFourDigits: string) => Promise<string>>(() => Promise.resolve('b9'))

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
        onTakeBack={onTakeBack}
        onAddAccount={onAddAccount}
        {...over}
      />
    ),
  })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)

  return { onPutIn, onTakeBack, onAddAccount }
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
    const user = userEvent.setup()
    const { onPutIn } = renderWith({ received: [] })
    await screen.findByLabelText('How much')

    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '2500000' } })
    await pick(user, 'Who it came from', 'The one it is built for')
    fireEvent.click(screen.getByRole('radio', { name: 'The house sold' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      // A list of one: an arrival that came in one way is one row, and money split between two ways is two.
      expect(onPutIn).toHaveBeenCalledWith([
        expect.objectContaining({ amount: '2,500,000', fromId: 'p1', why: 'sale', method: 'cash' }),
      ])
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

  it('lets an account be added from the picker, on a screen that had no way to add one at all', async () => {
    // Money coming in never had one: an account missing from the list stopped the receipt, and the way out was another screen and a retyped form.
    const user = userEvent.setup()
    const { onAddAccount } = renderWith()

    await user.click(await screen.findByRole('radio', { name: 'Transfer' }))
    await useTheName(user, 'Which account it landed in', 'Bank 7788')
    await user.type(screen.getByLabelText('The account number for Bank 7788'), '11112222337788')
    await user.click(screen.getByRole('button', { name: 'Put it on the list' }))

    // Only the last four were handed on: the rest never crosses the wire.
    expect(onAddAccount).toHaveBeenCalledWith('Bank 7788', '7788')
    expect(JSON.stringify(onAddAccount.mock.calls)).not.toContain('1111')
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

  it('puts up the shape of what is coming while the answer is on its way, and nothing for a house that is not there', async () => {
    renderWith({ received: undefined })
    // Said once when it appears rather than drawn and left silent, because a pulse is nothing to a screen reader.
    expect(await screen.findByRole('status', { name: 'Getting what has come in' })).toBeTruthy()
    expect(screen.queryByText('Looking…')).toBeNull()

    cleanup()
    renderWith({ received: null })
    await screen.findByLabelText('How much')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('turns the button off while it is sending and says so without changing what it says', async () => {
    renderWith({ received: [], saving: true })

    const button = await screen.findByRole('button', { name: 'Put it in' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('empties the boxes once it has gone in', async () => {
    const user = userEvent.setup()
    renderWith({ received: [] })
    await screen.findByLabelText('How much')

    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '2500000' } })
    await pick(user, 'Who it came from', 'The one it is built for')
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('')
    })
  })

  it('keeps what was typed when the server refused it', async () => {
    const user = userEvent.setup()
    // The refusal is about the amount in the box. Emptying the box on a no leaves him reading a sentence about a figure that is no longer on the screen, and typing the whole receipt again to see it.
    const { onPutIn } = renderWith({ received: [] })
    onPutIn.mockResolvedValue(false)
    await screen.findByLabelText('How much')

    fireEvent.change(screen.getByLabelText('How much'), { target: { value: '2500000' } })
    await pick(user, 'Who it came from', 'The one it is built for')
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }))

    await waitFor(() => {
      expect(onPutIn).toHaveBeenCalled()
    })

    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('2,500,000')
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

describe('taking money coming in back out', () => {
  it('takes back the one it was asked about', async () => {
    // Money going out could be taken back from the first day and money coming in could not. A partner's capital entered wrong was permanent, and capital is what the whole profit split is worked out from.
    const { onTakeBack } = renderWith()
    // Waited for by the buttons rather than by a name: a person is in the picker as well as in the list, and there are two of every name on this screen.
    const takingBack = await screen.findAllByRole('button', { name: 'Take it back' })

    fireEvent.click(takingBack[1])

    await waitFor(() => {
      expect(onTakeBack).toHaveBeenCalledWith('m2')
    })
  })

  it('says what the server said rather than turning the word back and doing nothing', async () => {
    const onTakeBack = vi.fn<(moneyInId: string) => Promise<void>>(() =>
      Promise.reject(new ConvexError('That money is not on this site.'))
    )
    renderWith({ onTakeBack })
    const takingBack = await screen.findAllByRole('button', { name: 'Take it back' })

    fireEvent.click(takingBack[0])

    expect((await screen.findByRole('alert')).textContent).toBe('That money is not on this site.')
  })

  it('offers it against every receipt, and none when nothing has come in', async () => {
    renderWith()
    expect(await screen.findAllByRole('button', { name: 'Take it back' })).toHaveLength(2)

    cleanup()
    renderWith({ received: [] })
    await screen.findByText(/Nothing has come in on this house yet/)
    expect(screen.queryByRole('button', { name: 'Take it back' })).toBeNull()
  })
})
