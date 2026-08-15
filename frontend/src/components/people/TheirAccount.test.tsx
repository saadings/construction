// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { Account, AccountLine } from './TheirAccount'
import { TheirAccount } from './TheirAccount'

afterEach(cleanup)

const LINES: Array<AccountLine> = [
  {
    what: 'paid',
    day: '2026-04-02',
    amountPaisa: 250_000_00,
    id: 'pay1',
    balancePaisa: 350_000_00,
    onWhichHouse: '1-A, Phase 0',
    said: '0184',
  },
  {
    what: 'billed',
    day: '2026-04-01',
    amountPaisa: 600_000_00,
    id: 'bill1',
    balancePaisa: 600_000_00,
    onWhichHouse: '1-A, Phase 0',
    said: 'Steel for the roof',
  },
]

function anAccount(over: Partial<Account> = {}): Account {
  return {
    name: 'A steel supplier',
    phone: '0300-0000000',
    lines: LINES,
    billedPaisa: 600_000_00,
    paidPaisa: 250_000_00,
    ...over,
  }
}

describe('somebody’s account', () => {
  it('reads a line for everything billed and everything paid, with the balance after each', () => {
    render(<TheirAccount answer={{ account: anAccount() }} />)

    const rows = screen.getAllByRole('listitem')
    // What was paid, and what was left after it.
    expect(within(rows[0]).getByText('250,000')).toBeTruthy()
    expect(within(rows[0]).getByText('350,000')).toBeTruthy()
    // The bill, and the balance it made -- the same figure in two columns, which is what the first line of a statement looks like.
    expect(within(rows[1]).getAllByText('600,000')).toHaveLength(2)
    expect(within(rows[1]).getByText('Steel for the roof')).toBeTruthy()
  })

  it('says which house each line was on, because the account spans all of them', () => {
    render(<TheirAccount answer={{ account: anAccount() }} />)

    expect(screen.getAllByText('1-A, Phase 0')).toHaveLength(2)
  })

  it('says what is standing in words rather than leaving a sign to be noticed', () => {
    render(<TheirAccount answer={{ account: anAccount() }} />)

    // The sentence itself carries the figure, rather than a minus sign somewhere for somebody to spot.
    expect(screen.getByText(/Owed/).textContent).toContain('350,000')
  })

  it('says an advance is an advance, not a balance below nothing', () => {
    // `ADV` and `BL PMT` are all over the workbooks. A credit is an ordinary position here, and a minus sign is not what somebody reads it by.
    render(<TheirAccount answer={{ account: anAccount({ billedPaisa: 100_000_00, paidPaisa: 250_000_00 }) }} />)

    expect(screen.getByText(/Holding/)).toBeTruthy()
    expect(screen.getByText(/in advance/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('-150,000')
  })

  it('says nothing is outstanding when the two sides meet', () => {
    render(<TheirAccount answer={{ account: anAccount({ billedPaisa: 250_000_00, paidPaisa: 250_000_00 }) }} />)

    expect(screen.getByText('Nothing outstanding either way.')).toBeTruthy()
  })

  it('shows a balance that has gone below nothing as an advance on the line as well', () => {
    render(
      <TheirAccount
        answer={{
          account: anAccount({
            lines: [{ ...LINES[0], balancePaisa: -150_000_00 }],
          }),
        }}
      />
    )

    const row = screen.getByRole('listitem')
    expect(within(row).getByText('150,000 adv')).toBeTruthy()
  })

  it('keeps billed and paid in their own columns rather than one column with a sign', () => {
    // A column somebody runs a finger down cannot mean two things.
    render(<TheirAccount answer={{ account: anAccount() }} />)

    const paid = screen.getAllByRole('listitem')[0]
    expect(within(paid).queryByText('Billed')).toBeNull()
    expect(within(paid).getByText('Paid')).toBeTruthy()
  })

  it('says what to do about an account with nothing on it', () => {
    render(<TheirAccount answer={{ account: anAccount({ lines: [], billedPaisa: 0, paidPaisa: 0 }) }} />)

    expect(screen.getByText(/Nothing on this account yet/)).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('keeps three unknowns apart rather than folding them together', () => {
    // Still coming.
    const { unmount } = render(<TheirAccount answer={undefined} />)
    expect(screen.getByRole('status', { name: 'Getting their account' })).toBeTruthy()
    unmount()

    // A sign-in the ledger has never seen.
    const known = render(<TheirAccount answer={null} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(/sign-in/i)).toBeTruthy()
    known.unmount()

    // Nobody by that name, which is a different sentence and not the same screen.
    render(<TheirAccount answer={{ account: null }} />)
    expect(screen.getByText(/Nobody by that name/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says nothing technical anywhere on it', () => {
    render(<TheirAccount answer={{ account: anAccount() }} />)

    expect(document.body.textContent).not.toMatch(/record|entity|paisa|query|database|null|undefined/i)
  })
})
