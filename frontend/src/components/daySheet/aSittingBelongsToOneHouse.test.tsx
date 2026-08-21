// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { whatWasKept } from '../../lib/keptOnThisDevice'
import { pick } from '../../testing/pick'
import type { Account, Named, Person } from './DaySheet'
import { DaySheet } from './DaySheet'
import { whereASittingIsKept } from './theSittingKept'

// A sitting is kept under one house and one day. `DaySheet` reads what was kept **once**, on mount, and writes on every change under whatever key it has now -- so a key that changed under a mounted sheet wrote the rows already typed to the *new* key, and never read the new key's own sitting.

// One house's payments landing under another house's, silently, on money, on the screen the whole app exists for.

// Reachable through the date picker since the day a sitting was first kept, and rarely hit, because a date is corrected by one step now and then. His daybook puts a house picker in the sticky header, which turns that into the ordinary way to use the screen -- so this is the test that arrives with it.

// Asked of `DaySheet` rather than of the route above it, because the route is where the fix is written and this has to fail if it moves. `key` is not a prop a component can read: what is being asked is that a sheet handed a new key behaves as a new sheet, and only its caller can arrange that.
const TRADES = [{ _id: 't1', name: 'Cement' }] as unknown as Array<Named>
const PEOPLE = [{ _id: 'p1', name: 'A mason' }] as unknown as Array<Person>
const ACCOUNTS = [{ _id: 'b1', label: 'Bank 0000' }] as unknown as Array<Account>

const FIRST = whereASittingIsKept('s1', '2026-07-23')
const SECOND = whereASittingIsKept('s2', '2026-07-23')

// The same key moving for the other reason. A day is corrected by one step now and then, which is how this was reachable long before there was a house picker -- and it is the one anybody would have hit first.
const THE_DAY_BEFORE = whereASittingIsKept('s1', '2026-07-22')

afterEach(cleanup)

/** The sheet as its route draws it: keyed on where the sitting is kept, so a new house or a new day is a new sheet. */
function sheet(keptUnder: string) {
  return (
    <DaySheet
      key={keptUnder}
      siteName="1-A, Phase 0"
      day="2026-07-23"
      onChangeDay={() => undefined}
      trades={TRADES}
      people={PEOPLE}
      accounts={ACCOUNTS}
      saving={false}
      refusal={null}
      onPutIn={vi.fn()}
      onAddAccount={vi.fn()}
      onAddTrade={vi.fn()}
      keptUnder={keptUnder}
    />
  )
}

async function putOneDown(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await pick(user, 'Category', 'Cement')
  await pick(user, 'Paid to', 'A mason')
  await user.type(screen.getByLabelText('Amount'), amount)
  await user.type(screen.getByLabelText('Cheque number'), '0001')
  await pick(user, 'Account', 'Bank 0000')
  await user.click(screen.getByRole('button', { name: 'Add another' }))
}

describe('a sitting when the house under it changes', () => {
  it('does not carry to the other house', async () => {
    window.localStorage.clear()
    const user = userEvent.setup()
    const { rerender } = render(sheet(FIRST))

    await putOneDown(user, '25000')
    rerender(sheet(SECOND))

    // Both halves. What is kept is the money-shaped one -- a payment filed against a house it was never made on -- and what is drawn is the one he would see and act on.
    expect(whatWasKept(SECOND), 'the other house was given this one’s sitting').toBeNull()
    expect(screen.queryByText('25,000'), 'the other house is showing this one’s sitting').toBeNull()
  })

  it('does not carry to the day before either, which is how anybody would have met it', async () => {
    // The same key moving for the other reason, and the one already reachable without a picker: correcting the date wrote the rows already typed onto the corrected day, and overwrote whatever that day was holding.
    window.localStorage.clear()
    const user = userEvent.setup()
    const { rerender } = render(sheet(FIRST))

    await putOneDown(user, '25000')
    rerender(sheet(THE_DAY_BEFORE))

    expect(whatWasKept(THE_DAY_BEFORE), 'the day before was given this day’s sitting').toBeNull()
    expect(screen.queryByText('25,000'), 'the day before is showing this day’s sitting').toBeNull()
  })

  it('leaves the first house holding what was typed against it', async () => {
    // The other end, and the reason a remount is the right answer rather than the cheap one: nothing is lost by switching. Without this, "does not carry" would pass just as well if the fix threw the sitting away.
    window.localStorage.clear()
    const user = userEvent.setup()
    const { rerender } = render(sheet(FIRST))

    await putOneDown(user, '25000')
    rerender(sheet(SECOND))

    expect(whatWasKept(FIRST)).not.toBeNull()
  })

  it('is keyed that way by the thing that actually draws it', async () => {
    // The three above are about the mechanism and they arrange it themselves, which is the hole: the route could stop keying the sheet tomorrow and every one of them would stay green, because each builds its own `key` in the helper at the top of this file.

    // `key` is not readable from inside a component and `ADayOfPayments` needs Convex to render, so this is the only thing joining the mechanism to the app. Shallow, and the only guard there is.
    const route = readFileSync('frontend/src/components/daySheet/ADayOfPayments.tsx', 'utf8')

    expect(route).toContain('key={keptUnder}')
    // And that the thing it is keyed on is really where the sitting is kept, rather than a variable that happens to share the name.
    expect(route).toMatch(/const keptUnder = whereASittingIsKept\(siteId, day\)/)
  })

  it('brings each house’s own sitting back when it is picked again', async () => {
    // Which is what the keeping was for. A sitting he left on one house is still there when he returns to it, and it says so rather than looking like something that has gone in.
    window.localStorage.clear()
    const user = userEvent.setup()
    const { rerender } = render(sheet(FIRST))

    await putOneDown(user, '25000')
    rerender(sheet(SECOND))
    rerender(sheet(FIRST))

    // Asked inside the list of what is down, because the running total says the same figure while it is the only row -- and a `getByText` for it finds two things and fails for the wrong reason.
    expect(within(await screen.findByRole('list')).getByText('25,000')).toBeTruthy()
    expect(screen.getByText(/Picked up where you left off/)).toBeTruthy()
  })
})
