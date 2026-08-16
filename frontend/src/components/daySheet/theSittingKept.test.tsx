// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { whatWasKept } from '../../lib/keptOnThisDevice'
import { pick } from '../../testing/pick'
import type { Account, Named, Person } from './DaySheet'
import { DaySheet } from './DaySheet'
import type { Draft } from './sitting'
import { aSittingWorthKeeping, whereASittingIsKept } from './theSittingKept'

// Eight payments typed standing on a site, the phone locks, iOS discards the tab, and the sitting is gone with nothing having warned him. React state was the only thing holding it.

// That is not a defect in a feature: it is the ledger losing the thing it exists to record, silently, and it is the worst failure this app had left.

const trades = [
  { _id: 't1', name: 'Cement' },
  { _id: 't2', name: 'Grey structure' },
] as unknown as Array<Named>

const people = [
  { _id: 'p1', name: 'The partner' },
  { _id: 'p2', name: 'A mason' },
] as unknown as Array<Person>

const accounts = [{ _id: 'b1', label: 'Bank 0000' }] as unknown as Array<Account>

const KEPT_UNDER = whereASittingIsKept('s1', '2026-07-23')

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(cleanup)

function aSheet(over: Partial<Parameters<typeof DaySheet>[0]> = {}) {
  const onPutIn = vi.fn<(drafts: Array<Draft>) => Promise<boolean>>(() => Promise.resolve(true))

  render(
    <DaySheet
      siteName="1-A, Phase 0"
      day="2026-07-23"
      onChangeDay={() => {}}
      trades={trades}
      people={people}
      accounts={accounts}
      saving={false}
      refusal={null}
      onPutIn={onPutIn}
      onAddAccount={async () => 'b2' as Account['_id']}
      onAddTrade={async () => 't9' as Named['_id']}
      keptUnder={KEPT_UNDER}
      {...over}
    />
  )

  return { onPutIn }
}

/** One line, typed the way somebody types it. Cash, because a cheque asks for its number and an account as well and none of that is what these are about. */
async function fillOne(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await pick(user, 'Trade', 'Cement')
  await pick(user, 'Paid to', 'A mason')
  await user.type(screen.getByLabelText('Amount'), amount)
  await user.click(screen.getByRole('radio', { name: 'Cash' }))
}

describe('a sitting on a phone that locks', () => {
  it('is kept as it is typed, before anything is put down', async () => {
    // The line he is in the middle of is the one he was looking at when the screen went dark, and the one he is least likely to remember. Keeping only what is finished loses exactly that.
    const user = userEvent.setup()
    aSheet()

    await fillOne(user, '25000')

    await waitFor(() => {
      expect(aSittingWorthKeeping(whatWasKept(KEPT_UNDER))?.draft.amount).toBe('25,000')
    })
  })

  it('is kept when a line is put down and another started', async () => {
    const user = userEvent.setup()
    aSheet()

    await fillOne(user, '25000')
    await user.click(screen.getByRole('button', { name: 'Add another' }))

    await waitFor(() => {
      expect(aSittingWorthKeeping(whatWasKept(KEPT_UNDER))?.done).toHaveLength(1)
    })
  })

  it('comes back when the sheet is opened again, and says it has not gone in', async () => {
    const user = userEvent.setup()
    aSheet()

    await fillOne(user, '25000')
    await user.click(screen.getByRole('button', { name: 'Add another' }))
    await waitFor(() => {
      expect(whatWasKept(KEPT_UNDER)).not.toBeNull()
    })

    // The tab dies here. What comes back is a fresh sheet reading what was kept.
    cleanup()
    aSheet()

    expect(screen.getByText(/Picked up where you left off/)).toBeTruthy()
    expect(screen.getByText(/None of this has gone in yet/)).toBeTruthy()

    // And the line itself is there, not just the sentence: the running total says it and so does the row in the sitting.
    expect(screen.getAllByText('25,000').length).toBeGreaterThan(1)
    expect(screen.getByText('1 put down · Thu 23 Jul')).toBeTruthy()
  })

  it('says nothing about picking up when there was nothing kept', () => {
    aSheet()

    expect(screen.queryByText(/Picked up where you left off/)).toBeNull()
  })

  it('is forgotten the moment it goes in', async () => {
    // What is kept is money-shaped -- who was paid and how much -- on a device he shares. It lives exactly as long as the sitting does.
    const user = userEvent.setup()
    aSheet()

    await fillOne(user, '25000')
    await waitFor(() => {
      expect(whatWasKept(KEPT_UNDER)).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(whatWasKept(KEPT_UNDER)).toBeNull()
    })
  })

  it('keeps it when the sitting is refused, because nothing has gone in', async () => {
    // The other half of the same rule. A refusal leaves the boxes exactly as they were, so what is on the device has to stay too -- forgetting it here would lose the sitting to a server that said no.
    const user = userEvent.setup()
    aSheet({ onPutIn: vi.fn<(drafts: Array<Draft>) => Promise<boolean>>(() => Promise.resolve(false)) })

    await fillOne(user, '25000')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Amount').value).toBe('25,000')
    })

    expect(whatWasKept(KEPT_UNDER)).not.toBeNull()
  })

  it('keeps one house apart from another, and one day apart from the next', () => {
    // A key of its own for each, so opening tomorrow never shows today's half-typed payment and another house never shows this one's.
    expect(whereASittingIsKept('s1', '2026-07-23')).not.toBe(whereASittingIsKept('s2', '2026-07-23'))
    expect(whereASittingIsKept('s1', '2026-07-23')).not.toBe(whereASittingIsKept('s1', '2026-07-24'))
  })

  it('opens on an empty sheet when what was kept cannot be read', () => {
    // Half-written when the tab died, or left by an older shape of this app. Unreadable is the same as nothing, and it must never be the reason the day sheet throws on open.
    window.localStorage.setItem(KEPT_UNDER, '{ this is not json')
    aSheet()

    expect(screen.queryByText(/Picked up where you left off/)).toBeNull()
    expect(screen.getByLabelText<HTMLInputElement>('Amount').value).toBe('')
  })

  it('keeps nothing at all on a sheet with nowhere to keep it', async () => {
    // The gallery draws this screen with no `keptUnder`, and a screen photographed for a picture must not write anybody's payment onto the machine taking the picture.
    const user = userEvent.setup()
    aSheet({ keptUnder: undefined })

    await fillOne(user, '25000')

    expect(window.localStorage.length).toBe(0)
  })
})

describe('what counts as a sitting worth keeping', () => {
  it('is nothing at all when nothing has been typed', () => {
    // Otherwise a sheet somebody opened and closed says "picked up where you left off" to somebody who left off nowhere.
    expect(aSittingWorthKeeping({ done: [], draft: { amount: '', tradeId: '', newPerson: '' } })).toBeNull()
  })

  it('is a sitting the moment any of it is answered', () => {
    expect(aSittingWorthKeeping({ done: [], draft: { amount: '25,000', tradeId: '', newPerson: '' } })).not.toBeNull()
    expect(aSittingWorthKeeping({ done: [], draft: { amount: '', tradeId: 't1', newPerson: '' } })).not.toBeNull()
    expect(aSittingWorthKeeping({ done: [{}], draft: { amount: '', tradeId: '', newPerson: '' } })).not.toBeNull()
  })

  it('is nothing at all for anything that is not a sitting', () => {
    expect(aSittingWorthKeeping(null)).toBeNull()
    expect(aSittingWorthKeeping('a sitting')).toBeNull()
    expect(aSittingWorthKeeping({ done: 'two' })).toBeNull()
  })
})
