// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick } from '../../testing/pick'
import type { AgreedShare, Somebody } from './AgreeShares'
import { AgreeShares } from './AgreeShares'
import type { Position, WhatThePartnersHave } from './Positions'

afterEach(cleanup)

const TWO: Array<Position> = [
  {
    personId: 'p1',
    name: 'The one who started it',
    capitalPaisa: 600_000_000,
    basisPoints: 6000,
    duePaisa: 0,
    paidPaisa: 0,
    balancePaisa: 0,
  },
  {
    personId: 'p2',
    name: 'The one who came in later',
    capitalPaisa: 400_000_000,
    basisPoints: 4000,
    duePaisa: 0,
    paidPaisa: 0,
    balancePaisa: 0,
  },
]

// The whole reading the house page gets, because this screen is handed the same one rather than a slice of it.
function houseWhere(over: Partial<WhatThePartnersHave> = {}): WhatThePartnersHave {
  return {
    positions: TWO,
    broughtInPaisa: 0,
    spentPaisa: 0,
    profitPaisa: 0,
    sold: false,
    sharesAgreed: false,
    ifItSoldToday: null,
    ...over,
  }
}

const EVERYBODY: Array<Somebody> = [
  { _id: 'p1', name: 'The one who started it' },
  { _id: 'p2', name: 'The one who came in later' },
  { _id: 'p3', name: 'The one who put nothing in' },
]

function renderWith(over: Partial<Parameters<typeof AgreeShares>[0]> = {}) {
  const onAgree = vi.fn<(agreedOn: string, shares: Array<AgreedShare>) => Promise<boolean>>(() => Promise.resolve(true))
  const onFollowTheMoney = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true))

  render(
    <AgreeShares
      siteName="1-A, Phase 0"
      what={houseWhere()}
      everybody={EVERYBODY}
      saving={false}
      refusal={null}
      onAgree={onAgree}
      onFollowTheMoney={onFollowTheMoney}
      {...over}
    />
  )

  return { onAgree, onFollowTheMoney }
}

describe('agreeing what each partner takes', () => {
  it('opens on what the house reads as today, rather than on empty boxes', () => {
    renderWith()

    expect(screen.getByLabelText<HTMLInputElement>('The one who started it’s share').value).toBe('60')
    expect(screen.getByLabelText<HTMLInputElement>('The one who came in later’s share').value).toBe('40')
    // And what each of them put in, beside the share it is agreed against.
    expect(screen.getByText('6,000,000')).toBeTruthy()
  })

  it('says whether a house is following the money or an agreement', () => {
    renderWith()
    expect(screen.getByText(/These follow what each of them has put in/)).toBeTruthy()

    cleanup()
    renderWith({ what: houseWhere({ sharesAgreed: true }) })
    expect(screen.getByText(/what they agreed between them/)).toBeTruthy()
  })

  it('says what the shares come to while they are being typed, in the words the refusal uses', () => {
    renderWith()
    expect(screen.getByRole('status').textContent).toBe('These come to the whole.')

    fireEvent.change(screen.getByLabelText('The one who came in later’s share'), { target: { value: '30' } })

    // The server's own sentence, with the house named and the gap in it. Two wordings for one rule is how a screen ends up disagreeing with the refusal.
    expect(screen.getByRole('status').textContent).toBe(
      'Those shares are 10% short of the whole on 1-A, Phase 0. They have to come to 100%.'
    )
  })

  it('says when they come to more than the whole, not only when they come to less', () => {
    renderWith()

    fireEvent.change(screen.getByLabelText('The one who started it’s share'), { target: { value: '75' } })

    expect(screen.getByRole('status').textContent).toBe(
      'Those shares are 15% more than the whole on 1-A, Phase 0. They have to come to 100%.'
    )
  })

  it('hands over what was typed, as it was typed', async () => {
    const { onAgree } = renderWith()

    fireEvent.change(screen.getByLabelText('The one who started it’s share'), { target: { value: '33.33' } })
    fireEvent.change(screen.getByLabelText('The one who came in later’s share'), { target: { value: '66.67' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree these shares' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith(expect.any(String), [
        { personId: 'p1', share: '33.33' },
        { personId: 'p2', share: '66.67' },
      ])
    })
  })

  it('lets somebody take a share who has put nothing in', async () => {
    const user = userEvent.setup()
    const { onAgree } = renderWith()

    // Who funded a house and who takes the profit are not always the same people.
    await pick(user, 'Somebody else takes a share', 'The one who put nothing in')

    const put = await screen.findByLabelText('The one who put nothing in’s share')
    fireEvent.change(put, { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree these shares' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([{ personId: 'p3', share: '10' }])
      )
    })
  })

  it('offers nobody who is already down for a share', async () => {
    // The list is behind a popup now rather than inside the control, so it is read where somebody would read it: opened.
    const user = userEvent.setup()
    renderWith()

    await user.click(screen.getByRole('combobox', { name: 'Somebody else takes a share' }))

    const offered = screen.getAllByRole('option').map((one) => one.textContent)
    expect(offered).not.toContain('The one who started it')
    expect(offered).toContain('The one who put nothing in')
  })

  it('takes somebody out who funded the house and takes none of it', async () => {
    const { onAgree } = renderWith()

    // Named rather than the second of a list of identical buttons. Two rows both said "Take out", so this was `[1]` -- a positional guess that says nothing about which partner it removes, which is the whole of what this test is about. A screen reader had the same problem and no index to fall back on.
    fireEvent.click(screen.getByRole('button', { name: 'Take The one who came in later out of the shares' }))
    fireEvent.change(screen.getByLabelText('The one who started it’s share'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree these shares' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith(expect.any(String), [{ personId: 'p1', share: '100' }])
    })
  })

  it('draws the way out as something to press rather than as text', () => {
    // It was grey text with no border and no underline, on its own line between a share and a figure -- so at 390 it read as the caption for the figure under it. Nobody could see that until a screen was photographed.

    // Underlined because an underline is an affordance, not because the app had settled on one: four of its nine ways out are underlined, four are plain text and one is red. jsdom applies no CSS, so this is the class and not the appearance; where it sits on the line is a fact about layout and is checked by the picture.
    renderWith()

    const out = screen.getByRole('button', { name: 'Take The one who started it out of the shares' })

    expect(out.className).toContain('underline')
  })

  it('names who each way out is about, rather than leaving two of them alike', () => {
    // Two rows both said "Take out". A test could reach the second by index; somebody listening could not, and neither could anybody scanning the two.
    renderWith()

    const named = screen
      .getAllByRole('button', { name: /out of the shares$/ })
      .map((one) => one.getAttribute('aria-label'))

    expect(named).toEqual([
      'Take The one who started it out of the shares',
      'Take The one who came in later out of the shares',
    ])
  })

  it('says what is wrong with one share once the eye has left it, and not before', () => {
    renderWith()

    fireEvent.change(screen.getByLabelText('The one who started it’s share'), { target: { value: 'half' } })
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.blur(screen.getByLabelText('The one who started it’s share'))
    expect(screen.getByRole('alert').textContent).toBe('Put in a share, like 33.33.')
  })

  it('says nothing about a box nobody has finished with', () => {
    // An empty share is a row somebody is partway through, not a figure they got wrong. What it comes to says the rest.
    renderWith()

    fireEvent.change(screen.getByLabelText('The one who started it’s share'), { target: { value: '' } })
    fireEvent.blur(screen.getByLabelText('The one who started it’s share'))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers the way back only where there is something to go back from', () => {
    renderWith()
    expect(screen.queryByRole('button', { name: 'Go back to what they put in' })).toBeNull()

    cleanup()
    renderWith({ what: houseWhere({ sharesAgreed: true }) })
    expect(screen.getByRole('button', { name: 'Go back to what they put in' })).toBeTruthy()
  })

  it('puts a house back to shares that follow the money', async () => {
    const { onFollowTheMoney } = renderWith({ what: houseWhere({ sharesAgreed: true }) })

    fireEvent.click(screen.getByRole('button', { name: 'Go back to what they put in' }))

    await waitFor(() => {
      expect(onFollowTheMoney).toHaveBeenCalled()
    })
  })

  it('shows the refusal the server sent, in its own words', () => {
    renderWith({ refusal: 'Somebody is down twice. Put each person in once.' })

    expect(screen.getByRole('alert').textContent).toBe('Somebody is down twice. Put each person in once.')
  })

  it('turns the button off while it is sending and says so', () => {
    renderWith({ saving: true })

    const button = screen.getByRole('button', { name: 'Agree these shares' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('puts up the shape of what is coming, and nothing for a house that is not there', () => {
    renderWith({ what: undefined })
    expect(screen.getByRole('status', { name: 'Getting who takes what' })).toBeTruthy()

    cleanup()
    renderWith({ what: null })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('draws what belongs under it, and hands over the reading it is drawn from', () => {
    // What goes underneath is the payout form, and nothing else on this screen would notice it missing: it is reached by the route, its own tests render it directly, and the guard that checks a mutation is reachable reads the source rather than the screen. So this is where a deleted line would be caught.
    const beneath = vi.fn<(what: WhatThePartnersHave) => ReactNode>(() => <p>What has gone back to them</p>)

    renderWith({ beneath })

    expect(screen.getByText('What has gone back to them')).toBeTruthy()
    // Handed the reading itself, rather than the screen flattening it into a list first. That is the difference between a house with no partners and one whose partners have not arrived.
    expect(beneath.mock.calls[0]?.[0].positions).toEqual(TWO)
  })

  it('draws nothing underneath while the reading is still coming, or where there is no house', () => {
    // The control. Drawn regardless, the payout form would offer to pay partners nobody has read yet.
    const beneath = vi.fn<(what: WhatThePartnersHave) => ReactNode>(() => <p>What has gone back to them</p>)

    renderWith({ what: undefined, beneath })
    expect(screen.queryByText('What has gone back to them')).toBeNull()

    cleanup()
    renderWith({ what: null, beneath })
    expect(screen.queryByText('What has gone back to them')).toBeNull()

    expect(beneath).not.toHaveBeenCalled()
  })

  it('says what to do about a house nobody has put money into yet', () => {
    renderWith({ what: houseWhere({ positions: [] }) })

    expect(screen.getByText(/Nobody has put money into this house yet/)).toBeTruthy()
  })

  it('says nothing technical anywhere on it', () => {
    renderWith({ what: houseWhere({ sharesAgreed: true }) })

    expect(document.body.textContent).not.toMatch(/basis|paisa|record|entity|query|database|null|undefined/i)
  })
})
