// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Route } from '../../routes/sites.$siteId.daybook'
import { pick } from '../../testing/pick'
import type { Account, Named, Person } from './DaySheet'
import { DaySheet, whatToOpenOn } from './DaySheet'
import { anEmptyDraft } from './sitting'
import { whereASittingIsKept } from './theSittingKept'

// A `Pay` on the payables rail opens this sheet with the man already chosen. The half that reads the address lives here, and it landed before the half that sends one -- a reader nobody sends to is a no-op, where a link nothing reads navigates, draws the right screen, chooses nobody, and photographs exactly like a link that worked.

const trades = [{ _id: 't1', name: 'Cement' }] as unknown as Array<Named>

const people = [
  { _id: 'p1', name: 'The partner' },
  { _id: 'p2', name: 'A mason' },
] as unknown as Array<Person>

const accounts = [{ _id: 'b1', label: 'Bank 0000' }] as unknown as Array<Account>

const THE_DAY = '2026-07-23'
const KEPT_UNDER = whereASittingIsKept('s1', THE_DAY)

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function aSheet(over: Partial<Parameters<typeof DaySheet>[0]> = {}) {
  const onPayingTaken = vi.fn()

  render(
    <DaySheet
      siteName="1-A, Phase 0"
      day={THE_DAY}
      onChangeDay={() => {}}
      trades={trades}
      people={people}
      accounts={accounts}
      saving={false}
      refusal={null}
      onPutIn={vi.fn()}
      onAddAccount={vi.fn(async () => 'b2' as Account['_id'])}
      onAddTrade={vi.fn(async () => 't9' as Named['_id'])}
      onPayingTaken={onPayingTaken}
      {...over}
    />
  )

  return { onPayingTaken }
}

/** A sitting already on this device, part-written, with whoever is named in it. */
function alreadyBeingPaid(who: { paidToId?: string; newPerson?: string }) {
  window.localStorage.setItem(
    KEPT_UNDER,
    JSON.stringify({ done: [], draft: { ...anEmptyDraft(), amount: '10,000', ...who } })
  )
}

describe('what the sheet opens on when a link names somebody', () => {
  it('puts him in, when nobody has been chosen', () => {
    const opened = whatToOpenOn(anEmptyDraft(), 'p2', people)

    expect(opened.draft.paidToId).toBe('p2')
    expect(opened.heldBack).toBeNull()
  })

  it('leaves the sheet exactly as it was when no link named anybody', () => {
    // The control. Every assertion here is about a difference from this, so a version that filled the field regardless would pass the one above and fail nothing.
    const opened = whatToOpenOn(anEmptyDraft(), undefined, people)

    expect(opened.draft).toEqual(anEmptyDraft())
    expect(opened.heldBack).toBeNull()
  })

  it.each([
    ['somebody hidden or removed since the link was made', 'p9'],
    ['somebody who is on another house', 'p404'],
  ])('ignores %s rather than refusing to draw', (_what, who) => {
    const opened = whatToOpenOn(anEmptyDraft(), who, people)

    // A URL outlives the row it was copied from, and a link that breaks a screen is worse than one that quietly does nothing.
    expect(opened.draft.paidToId).toBe('')
    expect(opened.heldBack).toBeNull()
  })

  it('does not put him over a payment already part-written to somebody else, and says why', () => {
    const held = { ...anEmptyDraft(), paidToId: 'p1' as ReturnType<typeof anEmptyDraft>['paidToId'] }
    const opened = whatToOpenOn(held, 'p2', people)

    // The whole point of deferring: his own half-typed payment is still here.
    expect(opened.draft.paidToId).toBe('p1')
    // And the whole point of speaking: a link that navigates and silently changes nothing is indistinguishable from one that worked.
    expect(opened.heldBack).toContain('The partner')
    expect(opened.heldBack).toContain('A mason')
  })

  it('defers to a one-off name typed by hand, which is a choice too', () => {
    const held = { ...anEmptyDraft(), newPerson: 'A tile man' }
    const opened = whatToOpenOn(held, 'p2', people)

    expect(opened.draft.paidToId).toBe('')
    expect(opened.heldBack).toContain('A tile man')
  })
})

describe('what the address is allowed to say', () => {
  // The guard on the other side of this contract reads the route's source for the word. That cannot tell a parameter that is declared from one that is parsed, which is the same blindness as a rule that greps for a component instead of drawing it -- so this calls the route's own reader.
  const readsTheAddress = Route.options.validateSearch as (search: Record<string, unknown>) => { paying?: string }

  it('takes a person out of the address', () => {
    expect(readsTheAddress({ paying: 'p2' })).toEqual({ paying: 'p2' })
  })

  it.each([
    ['an empty one', { paying: '' }],
    ['one that is not a string, because an address can say anything', { paying: 42 }],
    ['nothing at all, which is every ordinary opening of this screen', {}],
  ])('carries nobody for %s', (_what, search) => {
    expect(readsTheAddress(search)).toEqual({})
  })
})

describe('the day sheet, arriving with somebody to pay', () => {
  it('opens with him already in the field', async () => {
    aSheet({ paying: 'p2', keptUnder: KEPT_UNDER })

    expect((await screen.findByLabelText<HTMLInputElement>('Paid to')).value).toBe('A mason')
  })

  it('says it has been read, so the address can stop carrying him', () => {
    const { onPayingTaken } = aSheet({ paying: 'p2', keptUnder: KEPT_UNDER })

    expect(onPayingTaken).toHaveBeenCalled()
  })

  it('says nothing back when no link named anybody', () => {
    // Otherwise the address would be rewritten on every ordinary opening of this screen.
    const { onPayingTaken } = aSheet({ keptUnder: KEPT_UNDER })

    expect(onPayingTaken).not.toHaveBeenCalled()
  })

  it('still draws, with nobody chosen, when the link names somebody it cannot find', async () => {
    aSheet({ paying: 'p9', keptUnder: KEPT_UNDER })

    expect((await screen.findByLabelText<HTMLInputElement>('Paid to')).value).toBe('')
    // Drawn at all is the assertion: the failure this guards against is a screen that throws on a stale bookmark.
    expect(screen.getByLabelText('Amount')).toBeTruthy()
  })

  it('explains itself on screen when a part-written payment is in the way', async () => {
    alreadyBeingPaid({ paidToId: 'p1' })

    aSheet({ paying: 'p2', keptUnder: KEPT_UNDER })

    // By what it says rather than by its role: the sheet already has a live region for whether a sitting is going in, and asking for the role finds both.
    const said = await screen.findByText(/part-written here/)

    expect(said.textContent).toContain('The partner')
    expect(said.textContent).toContain('A mason')
    expect(screen.getByLabelText<HTMLInputElement>('Paid to').value).toBe('The partner')
  })

  it('takes the sentence away once he answers the question it was about', async () => {
    alreadyBeingPaid({ paidToId: 'p1' })

    const user = userEvent.setup()
    aSheet({ paying: 'p2', keptUnder: KEPT_UNDER })

    expect(await screen.findByText(/part-written here/)).toBeTruthy()

    await pick(user, 'Paid to', 'A mason')

    expect(screen.queryByText(/part-written here/)).toBeNull()
  })
})
