// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WhatIsWaiting } from './WhatIsWaiting'
import type { StillWaiting } from './theSittingKept'
import { whereASittingIsKept } from './theSittingKept'

afterEach(cleanup)

const ON_ANOTHER_HOUSE: StillWaiting = {
  keptUnder: whereASittingIsKept('s2', '2026-07-11'),
  siteId: 's2',
  day: '2026-07-11',
  entries: 3,
  paisa: 240_000_00,
}

const HERE: StillWaiting = {
  keptUnder: whereASittingIsKept('s1', '2026-07-23'),
  siteId: 's1',
  day: '2026-07-23',
  entries: 1,
  paisa: 25_000_00,
}

describe('what was typed here and not sent', () => {
  it('says where it is and how much of it there is', async () => {
    // The whole reason the badge waited for this. A count on the rail says `you have work that is not in the ledger` and then has to be able to say where -- and the work that gets lost is on the house nobody is looking at.
    render(<WhatIsWaiting waiting={[ON_ANOTHER_HOUSE]} hereNow={HERE.keptUnder} onOpen={vi.fn()} />)

    const row = await screen.findByRole('listitem')

    expect(within(row).getByText('Sat 11 Jul')).toBeTruthy()
    expect(within(row).getByText('3 entries')).toBeTruthy()
    expect(within(row).getByText('240,000')).toBeTruthy()
  })

  it('is a way in and never a way out', () => {
    // Nothing here removes anything. What is kept is what he typed, and a control that throws it away sitting beside a sentence saying it is not in the ledger yet is the worst place in the app for one.
    render(<WhatIsWaiting waiting={[ON_ANOTHER_HOUSE]} hereNow={HERE.keptUnder} onOpen={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Remove|Discard|Delete/ })).toBeNull()
  })

  it('opens the one that was picked, with its day as well as its house', async () => {
    // Both, because a sitting is kept under the pair. Moving the house alone lands on that house's *today*, which is a different sitting and an empty one.
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<WhatIsWaiting waiting={[ON_ANOTHER_HOUSE]} hereNow={HERE.keptUnder} onOpen={onOpen} />)

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(onOpen).toHaveBeenCalledWith(ON_ANOTHER_HOUSE)
  })

  it('leaves out the one already on the screen underneath', () => {
    // It is in front of him, with its rows and its running total. Saying it again here is saying it twice, and the second one reads as a second sitting.
    render(<WhatIsWaiting waiting={[HERE, ON_ANOTHER_HOUSE]} hereNow={HERE.keptUnder} onOpen={vi.fn()} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('25,000')).toBeNull()
  })

  it('is not on the screen at all when there is nothing waiting elsewhere', () => {
    // A block headed with what is unfinished, drawn on the days nothing is, is a block that stops being read.
    const { container } = render(<WhatIsWaiting waiting={[HERE]} hereNow={HERE.keptUnder} onOpen={vi.fn()} />)

    expect(container.textContent).toBe('')
  })

  it('says none of it is in the ledger, where he is looking at it', () => {
    // The one thing this block must not be mistaken for. Rows on a screen say nothing about whether they went in, and a sitting silently believed to be posted is worse than one lost.
    render(<WhatIsWaiting waiting={[ON_ANOTHER_HOUSE]} hereNow={HERE.keptUnder} onOpen={vi.fn()} />)

    expect(screen.getByText(/None of it is in the ledger yet/)).toBeTruthy()
    expect(screen.getByText(/On this device only/)).toBeTruthy()
  })

  it('says entry rather than entries when there is one', () => {
    render(<WhatIsWaiting waiting={[{ ...ON_ANOTHER_HOUSE, entries: 1 }]} hereNow={HERE.keptUnder} onOpen={vi.fn()} />)

    expect(screen.getByText('1 entry')).toBeTruthy()
  })
})
