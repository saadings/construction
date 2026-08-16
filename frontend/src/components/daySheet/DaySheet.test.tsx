// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick, useTheName } from '../../testing/pick'
import type { Account, Named, Person } from './DaySheet'
import { DaySheet } from './DaySheet'
import type { Draft } from './sitting'

const trades = [
  { _id: 't1', name: 'Cement' },
  // Two words on purpose: what the ledger counts as the same trade ignores spacing as well as case, and a one-word name cannot tell the two rules apart.
  { _id: 't2', name: 'Grey structure' },
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
  const onAddTrade = vi.fn(async () => 't9' as Named['_id'])

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
      onAddTrade={onAddTrade}
      {...over}
    />
  )

  return { onPutIn, onAddAccount, onAddTrade }
}

async function fillOne(user: ReturnType<typeof userEvent.setup>, { amount = '49,150' } = {}) {
  await pick(user, 'What for', 'Cement')
  await pick(user, 'Who was paid', 'A mason')
  await user.type(screen.getByLabelText('How much'), amount)
  await user.type(screen.getByLabelText('Cheque number'), '0001')
  await pick(user, 'Which account', 'Bank 0000')
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

    // Said by the name he calls it rather than by the id it is stored under, because the control now holds the row rather than a string.
    expect(screen.getByLabelText<HTMLInputElement>('Which account').value).toBe('Bank 0000')
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

  it('lets every way of paying be found by what is written on it', async () => {
    // A row of choices inside a `<label>` gives its first button the label's own words as its name: "How paid How paid", which is what a screen reader says and what nothing can find. Cheque is the default and the first of them, so it was the one nobody could reach by name.
    aSheet()

    for (const how of ['Cheque', 'Cash', 'Transfer', 'Pay order']) {
      expect(screen.getByRole('radio', { name: how })).toBeTruthy()
    }
  })

  it('takes a payment back out of the sitting before any of it goes in', async () => {
    // Nothing here has been written yet, so this is a row leaving the sitting rather than a payment leaving the ledger. Without it, a figure typed wrong five payments ago can only be fixed by putting the whole sitting in wrong and taking one out afterwards.
    const user = userEvent.setup()
    const { onPutIn } = aSheet()

    await fillOne(user, { amount: '25000' })
    await user.click(screen.getByRole('button', { name: 'Add another' }))
    await fillOne(user, { amount: '10000' })
    await user.click(screen.getByRole('button', { name: 'Add another' }))

    expect(within(screen.getByRole('list')).getByText('25,000')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Take out 25,000 to A mason' }))

    expect(within(screen.getByRole('list')).queryByText('25,000')).toBeNull()
    // And the total follows it out, because the total is what is in the sitting rather than what was ever typed into it.
    expect(within(screen.getByRole('banner')).getByText('10,000')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Put them in' }))
    expect(onPutIn).toHaveBeenCalledWith([expect.objectContaining({ amount: '10,000' })])
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

  it('lets an account be added from the picker, without leaving the sitting', async () => {
    // Cheque is the default and a cheque asks which account it left. With no accounts and no way to add one here, the first day sheet anyone opens is a dead end.

    // Asked of the picker rather than of a second control beside it: `Add an account` under the field was the workaround, and Nauman asked for the thing itself.
    const user = userEvent.setup()
    const { onAddAccount } = aSheet({ accounts: [] })

    await pick(user, 'What for', 'Cement')
    await user.type(screen.getByLabelText('How much'), '25000')

    await useTheName(user, 'Which account', 'Bank 0000')
    await user.type(screen.getByLabelText('The account number for Bank 0000'), '55555555550000')
    await user.click(screen.getByRole('button', { name: 'Put it on the list' }))

    // The whole number was typed; only its last four digits were handed on, so the rest never crosses the wire.
    expect(onAddAccount).toHaveBeenCalledWith('Bank 0000', '0000')
    expect(JSON.stringify(onAddAccount.mock.calls)).not.toContain('5555555555')
    // Back in the sitting with the account chosen, and nothing typed so far thrown away.
    expect(screen.getByLabelText<HTMLInputElement>('What for').value).toBe('Cement')
    expect(screen.getByLabelText<HTMLInputElement>('How much').value).toBe('25,000')
  })

  it('asks what kind of cost a new trade is, and never guesses it', async () => {
    // The reason `What for` had no add at all. A trade carries whether it is part of what the house cost, and a guess there moves money between two totals on two screens with nothing saying it was guessed.
    const user = userEvent.setup()
    const { onAddTrade } = aSheet()

    await useTheName(user, 'What for', 'Scaffolding')

    // Nothing has been added yet: the offer opens the question rather than answering it.
    expect(onAddTrade).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: 'Land, taxes and commission' }))
    await user.click(screen.getByRole('button', { name: 'Put it on the list' }))

    expect(onAddTrade).toHaveBeenCalledWith({ name: 'Scaffolding', countsAsBuildingCost: false })
    // Added and picked. Adding a trade and leaving the field empty is the same walk again.
    expect(screen.getByLabelText<HTMLInputElement>('What for').value).toBe('Scaffolding')
  })

  it('offers nothing to add for a trade already on the list, however it is spelt or spaced', async () => {
    // Two rows for one trade is the failure `personAlreadyCalled` exists to stop on the people side, arriving on a side with no such guard: every figure about `Cement` split across both, quietly.

    // Spaced rather than merely mis-cased, because the picker's own default already ignores case and trims the ends -- so a one-word name proves nothing about whether this control is using the ledger's rule. `sameTrade` is what the server refuses duplicates by, and this is the difference between the two.
    const user = userEvent.setup()
    aSheet()

    await user.click(screen.getByRole('combobox', { name: 'What for' }))
    await user.type(screen.getByRole('combobox', { name: 'What for' }), ' grey  STRUCTURE ')

    expect(screen.queryByRole('button', { name: /^Use/ })).toBeNull()
  })

  it('names no screen that does not exist', () => {
    aSheet({ accounts: [] })

    // The hint used to send him to a More tab that was never built, which is copy promising something the app does not have.
    expect(document.body.textContent).not.toContain('More')

    // What replaced the promise: the account is added from the picker itself, so the way to add one is where he is already looking rather than on another screen.
    expect(screen.getByRole('combobox', { name: 'Which account' }).getAttribute('placeholder')).toBe('No accounts yet')
  })

  it('sends the whole sitting in one go', async () => {
    const user = userEvent.setup()
    const { onPutIn } = aSheet()

    await fillOne(user, { amount: '25000' })
    await user.click(screen.getByRole('button', { name: 'Add another' }))
    await pick(user, 'What for', 'Grey structure')
    await pick(user, 'Who was paid', 'A mason')
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

    await pick(user, 'What for', 'Cement')
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

    await pick(user, 'What for', 'Cement')

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
