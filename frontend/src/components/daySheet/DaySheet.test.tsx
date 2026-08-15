// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Account, Named, Person } from './DaySheet'
import { DaySheet } from './DaySheet'
import type { Draft } from './sitting'

const trades = [
  { _id: 't1', name: 'Cement' },
  { _id: 't2', name: 'Bricks' },
] as unknown as Array<Named>

const people = [
  { _id: 'p1', name: 'The partner' },
  { _id: 'p2', name: 'A mason' },
] as unknown as Array<Person>

const accounts = [{ _id: 'b1', label: 'Bank 0000' }] as unknown as Array<Account>

afterEach(cleanup)

function aSheet(over: Partial<Parameters<typeof DaySheet>[0]> = {}) {
  const onPutIn = vi.fn()
  const onAddAccount = vi.fn(async () => 'b2' as Account['_id'])

  render(
    <DaySheet
      siteName="1-A, Phase 0"
      day="2025-10-07"
      onChangeDay={() => {}}
      trades={trades}
      people={people}
      accounts={accounts}
      saving={false}
      refusal={null}
      onPutIn={onPutIn}
      onAddAccount={onAddAccount}
      {...over}
    />
  )

  return { onPutIn, onAddAccount }
}

async function fillOne(user: ReturnType<typeof userEvent.setup>, { amount = '49,150' } = {}) {
  await user.selectOptions(screen.getByLabelText('What for'), 'Cement')
  await user.selectOptions(screen.getByLabelText('Who was paid'), 'A mason')
  await user.type(screen.getByLabelText('How much'), amount)
  await user.type(screen.getByLabelText('Cheque number'), '0001')
  await user.selectOptions(screen.getByLabelText('Which account'), 'Bank 0000')
}

describe('a day of payments', () => {
  it('groups an amount with commas as it is typed', async () => {
    const user = userEvent.setup()
    aSheet()

    await user.type(screen.getByLabelText('How much'), '4974980')

    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('4,974,980')
  })

  it('keeps the running total of the sitting at the top', async () => {
    const user = userEvent.setup()
    aSheet()

    await fillOne(user, { amount: '25000' })
    await user.click(screen.getByRole('button', { name: 'Add another' }))
    await user.type(screen.getByLabelText('How much'), '10000')

    // What is already down plus what is being typed, because he is reconciling against a cheque book while he types.
    expect(screen.getByText('35,000')).toBeTruthy()
  })

  it('keeps the site, the day and the account for the next payment', async () => {
    const user = userEvent.setup()
    aSheet()

    await fillOne(user)
    await user.click(screen.getByRole('button', { name: 'Add another' }))

    expect(screen.getByLabelText<HTMLSelectElement>('Which account').value).toBe('b1')
    // What does change: it is a different trade, a different person and a different amount every time.
    expect(screen.getByLabelText<HTMLSelectElement>('What for').value).toBe('')
    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('')
    expect(screen.getByText('1-A, Phase 0')).toBeTruthy()
  })

  it('shows what is already down while the next one is typed', async () => {
    const user = userEvent.setup()
    aSheet()

    await fillOne(user, { amount: '25000' })
    await user.click(screen.getByRole('button', { name: 'Add another' }))

    const alreadyDown = screen.getByRole('list')
    expect(within(alreadyDown).getByText('Cement')).toBeTruthy()
    expect(within(alreadyDown).getByText('A mason')).toBeTruthy()
    expect(within(alreadyDown).getByText('25,000')).toBeTruthy()
  })

  it('asks for a cheque number only for a cheque', async () => {
    const user = userEvent.setup()
    aSheet()

    expect(screen.getByLabelText('Cheque number')).toBeTruthy()

    await user.click(screen.getByRole('radio', { name: 'Cash' }))

    // Not there at all, rather than there and greyed out: a question that does not apply should not be on the screen.
    expect(screen.queryByLabelText('Cheque number')).toBeNull()
    expect(screen.queryByLabelText('Which account')).toBeNull()
  })

  it('asks which account for a transfer but not for a pay order', async () => {
    const user = userEvent.setup()
    aSheet()

    await user.click(screen.getByRole('radio', { name: 'Transfer' }))
    expect(screen.getByLabelText('Which account')).toBeTruthy()
    expect(screen.queryByLabelText('Cheque number')).toBeNull()

    // A pay order can be bought over the counter with cash, so there may be no account behind it.
    await user.click(screen.getByRole('radio', { name: 'Pay order' }))
    expect(screen.queryByLabelText('Which account')).toBeNull()
  })

  it('lets an account be added without leaving the sitting', async () => {
    // Cheque is the default and a cheque asks which account it left. With no accounts and no way to add one here, the first day sheet anyone opens is a dead end.
    const user = userEvent.setup()
    const { onAddAccount } = aSheet({ accounts: [] })

    await user.selectOptions(screen.getByLabelText('What for'), 'Cement')
    await user.type(screen.getByLabelText('How much'), '25000')

    await user.click(screen.getByRole('button', { name: 'Add an account' }))
    await user.type(screen.getByLabelText('What you call it'), 'Bank 0000')
    await user.type(screen.getByLabelText('Account number'), '55555555550000')
    await user.click(screen.getByRole('button', { name: 'Save it' }))

    // The whole number was typed; only its last four digits were handed on, so the rest never crosses the wire.
    expect(onAddAccount).toHaveBeenCalledWith('Bank 0000', '0000')
    expect(JSON.stringify(onAddAccount.mock.calls)).not.toContain('5555555555')
    // Back in the sitting with the account chosen, and nothing typed so far thrown away.
    expect(screen.getByLabelText<HTMLSelectElement>('What for').value).toBe('t1')
    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('25,000')
  })

  it('names no screen that does not exist', () => {
    aSheet({ accounts: [] })

    // The hint used to send him to a More tab that was never built, which is copy promising something the app does not have.
    expect(document.body.textContent).not.toContain('More')
    expect(screen.getByRole('button', { name: 'Add an account' })).toBeTruthy()
  })

  it('sends the whole sitting in one go', async () => {
    const user = userEvent.setup()
    const { onPutIn } = aSheet()

    await fillOne(user, { amount: '25000' })
    await user.click(screen.getByRole('button', { name: 'Add another' }))
    await user.selectOptions(screen.getByLabelText('What for'), 'Bricks')
    await user.selectOptions(screen.getByLabelText('Who was paid'), 'A mason')
    await user.type(screen.getByLabelText('How much'), '10000')
    await user.type(screen.getByLabelText('Cheque number'), '0002')
    await user.click(screen.getByRole('button', { name: 'Put them in' }))

    expect(onPutIn).toHaveBeenCalledTimes(1)
    const sent = onPutIn.mock.calls[0]?.[0] as Array<Draft>
    expect(sent).toHaveLength(2)
    expect(sent.map((each) => each.amount)).toEqual(['25,000', '10,000'])
  })

  it('says what is missing in words a person would use, and sends nothing', async () => {
    const user = userEvent.setup()
    const { onPutIn } = aSheet()

    await user.selectOptions(screen.getByLabelText('What for'), 'Cement')
    await user.click(screen.getByRole('button', { name: 'Put them in' }))

    expect(screen.getByRole('alert').textContent).toContain('Say who was paid.')
    expect(onPutIn).not.toHaveBeenCalled()
  })

  it('does not ask whose money it was, because there is one pot', async () => {
    // Nauman: "We dont need to specify whos money was used to pay in the pull in day." The partners' money is pooled the moment it goes in, so the question has no answer worth recording -- and it was one more thing to answer on every row of a cheque run.
    aSheet()

    expect(screen.queryByLabelText('Whose money')).toBeNull()
  })

  it('never puts a technical word on the screen', async () => {
    const user = userEvent.setup()
    aSheet({ refusal: 'This site is not one of yours.' })

    await user.click(screen.getByRole('button', { name: 'Put them in' }))

    const onScreen = document.body.textContent
    for (const technical of [
      'record',
      'entry',
      'entity',
      'ledger',
      'sync',
      'category',
      'vendor',
      'field',
      'validation',
      'required',
      'error',
      'database',
      'query',
    ]) {
      expect(onScreen.toLowerCase()).not.toContain(technical)
    }
    // The control: the assertion above passes against a blank screen, so something must actually be on it.
    expect(onScreen).toContain('1-A, Phase 0')
  })
})

describe('a question that answers for itself', () => {
  it('says nothing at all on a sitting nobody has touched', async () => {
    // Opening a day sheet is not a mistake. Six red questions before a single answer is the app shouting at somebody who has done nothing.
    aSheet()

    expect(await screen.findByLabelText('What for')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says what is missing beside the question that asked it, once the eye has moved on', async () => {
    const user = userEvent.setup()
    aSheet()

    // Straight past "what for" without answering it.
    await user.click(screen.getByLabelText('What for'))
    await user.click(screen.getByLabelText('How much'))

    expect(screen.getByRole('alert').textContent).toBe('Pick what this was for.')
  })

  it('takes it back the moment the question is answered', async () => {
    const user = userEvent.setup()
    aSheet()

    await user.click(screen.getByLabelText('What for'))
    await user.click(screen.getByLabelText('How much'))
    expect(screen.getByText('Pick what this was for.')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('What for'), 'Cement')

    // Only that one goes. The amount, which the eye also left, is still unanswered and still says so.
    expect(screen.queryByText('Pick what this was for.')).toBeNull()
    expect(screen.getByText('Put in how much was paid.')).toBeTruthy()
  })

  it('says nothing about a question this way of paying does not ask', async () => {
    // Cash asks for neither a cheque number nor an account, so neither is missing.
    const user = userEvent.setup()
    aSheet()

    await user.click(screen.getByRole('radio', { name: 'Cash' }))
    await user.click(screen.getByLabelText('How much'))
    await user.click(screen.getByLabelText('Note'))

    expect(screen.queryByText('Add the cheque number.')).toBeNull()
    expect(screen.queryByText('Say which account this left.')).toBeNull()
  })

  it('says an amount is missing beside the amount, not under the button', async () => {
    const user = userEvent.setup()
    aSheet()

    await user.click(screen.getByLabelText('How much'))
    await user.click(screen.getByLabelText('Note'))

    expect(screen.getByRole('alert').textContent).toBe('Put in how much was paid.')
    expect(screen.getByLabelText('How much').getAttribute('aria-invalid')).toBe('true')
  })
})
