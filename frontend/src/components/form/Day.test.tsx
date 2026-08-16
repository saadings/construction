// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { asCalendarDate } from '~shared/calendarDate'

import { Day, theDayIn } from './Day'
import { NEVER_SMALLER_THAN } from './Field'
import { whatDecidesTheSizeOf, whatSizeItComesTo } from './theSizeOnAPhone'

afterEach(cleanup)

// Two zones, one on each side of Greenwich, because the two halves of this conversion fail in opposite directions and a test run in one zone cannot see both. `new Date('2026-07-04')` is parsed as UTC midnight, which west of Greenwich is already the 3rd; `toISOString()` on a local midnight is the 3rd east of it. Run in UTC -- which is what CI is -- both mistakes come out right and the suite says nothing.

// Set on `process.env` rather than through a fixture, because that is what Node reads to answer `getDate()`, and it is read afresh on every `Date`. Vitest isolates a file per worker, so this reaches nothing but the block it is in.
function inTheZone(zone: string, ask: () => void) {
  const before = process.env.TZ

  try {
    process.env.TZ = zone
    ask()
  } finally {
    process.env.TZ = before
  }
}

/** East of Greenwich, which is where this ledger is kept and where writing a day out loses one. */
const LAHORE = 'Asia/Karachi'

/** West of it, where reading a day in loses one. Nobody here is in it; it is in this file because the mistake is symmetrical and only one zone at a time can show either half. */
const NEW_YORK = 'America/New_York'

describe('a day written the way this ledger writes one', () => {
  it('is the same day it was, on both sides of Greenwich', () => {
    for (const zone of [LAHORE, NEW_YORK]) {
      inTheZone(zone, () => {
        // Out: the 4th of July at local midnight is written as the 4th. `toISOString()` here answers the 3rd in Lahore.
        expect(asCalendarDate(new Date(2026, 6, 4)), `writing a day out in ${zone}`).toBe('2026-07-04')

        // And in: the 4th read back is the 4th on the calendar somebody is looking at. `new Date('2026-07-04')` here answers the 3rd in New York.
        const read = theDayIn('2026-07-04')

        expect(read, `reading a day in in ${zone}`).toBeInstanceOf(Date)
        expect([read?.getFullYear(), read?.getMonth(), read?.getDate()], `the day read in ${zone}`).toEqual([
          2026, 6, 4,
        ])
      })
    }
  })

  it('goes out and comes back as itself', () => {
    for (const day of ['2026-01-01', '2026-02-28', '2026-06-30', '2026-12-31', '2025-03-09']) {
      const read = theDayIn(day)

      expect(read, `${day} is a day`).toBeInstanceOf(Date)
      expect(asCalendarDate(read as Date), `${day} round trips`).toBe(day)
    }
  })

  it('refuses a day that is not on the calendar rather than answering a different one', () => {
    // `new Date(2026, 1, 31)` answers the 3rd of March. A date box that quietly moved a payment five weeks is worse than one that refuses it.
    expect(theDayIn('2026-02-31')).toBeUndefined()
    expect(theDayIn('2026-13-01')).toBeUndefined()
    expect(theDayIn('2026-00-10')).toBeUndefined()
    expect(theDayIn('2026-04-31')).toBeUndefined()
  })

  it('refuses anything that is not written as a day at all', () => {
    for (const said of ['', '2026-7-4', '04/07/2026', 'today', '2026-07-04T00:00:00Z', ' 2026-07-04']) {
      expect(theDayIn(said), `"${said}" is not a day`).toBeUndefined()
    }
  })

  it('takes a leap day in a year that has one and refuses it in a year that does not', () => {
    // 2029 is the nearest year where the answer differs, and it is the case a four-year rule gets right by accident.
    expect(asCalendarDate(theDayIn('2028-02-29') as Date)).toBe('2028-02-29')
    expect(theDayIn('2029-02-29')).toBeUndefined()
  })
})

describe('the one way this app asks for a day', () => {
  it('is never set smaller than a phone can be tapped on, in either look', () => {
    // The half no sweep of the screens can see: `Day` carries its own size, so a screen that hands it nothing is the normal case and there is no class list on any screen to read. shadcn's button is `text-sm`, which is the 14px this control was measured at.
    for (const look of ['asked', 'beside'] as const) {
      render(<Day look={look} label="Agreed on" value="2026-07-16" onPick={() => {}} />)

      const control = screen.getByRole('button', { name: 'Agreed on: 16/07/2026' })
      const { onAPhone, onADesk } = whatSizeItComesTo(whatDecidesTheSizeOf(control))

      expect(onAPhone, `as ${look} it sets no size at all`).not.toBeNull()
      expect(onAPhone, `as ${look} it is ${onAPhone}px on a phone`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)
      expect(onADesk, `as ${look} it is ${onADesk}px on a desk`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)

      cleanup()
    }
  })

  it('says which day it is holding, the day first and the month second', () => {
    // Nauman: "Date should be in this: DD/MM/YYYY". The sixteenth on purpose -- on the sixth of July both orders read plausibly and this could not tell them apart. The whole string, for the same reason.
    render(<Day label="Raised on" value="2026-07-16" onPick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Raised on: 16/07/2026' }).textContent).toBe('16/07/2026')
  })

  it('says so when no day has been chosen, rather than showing an empty box', () => {
    render(<Day label="Agreed on" value="" onPick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Agreed on: no day chosen' }).textContent).toContain('Pick a day')
  })

  it('carries its label into its name where nothing above it says one', () => {
    // A stage's date sits in a row whose visible words belong to the stage. Without this a screen reader is handed a date with nothing saying which stage it is on -- and `beside` draws no label of its own.
    render(<Day look="beside" label="When the roof was billed" value="2026-07-16" onPick={() => {}} />)

    expect(screen.getByRole('button', { name: 'When the roof was billed: 16/07/2026' })).toBeTruthy()
    expect(screen.queryByText('When the roof was billed')).toBeNull()
  })

  it('writes the label above it when it is asked as a question', () => {
    render(<Day label="Agreed on" hint="The day it was signed." value="" onPick={() => {}} />)

    expect(screen.getByText('Agreed on')).toBeTruthy()
    expect(screen.getByText('The day it was signed.')).toBeTruthy()
  })

  it('hands back the day that was tapped, written the way the ledger writes one', async () => {
    const picked: Array<string> = []

    render(<Day label="Agreed on" value="2026-07-16" onPick={(day) => picked.push(day)} />)

    await userEvent.click(screen.getByRole('button', { name: 'Agreed on: 16/07/2026' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Saturday, July 11th, 2026' }))

    expect(picked).toEqual(['2026-07-11'])
  })

  it('hands back the month it is in for a day the calendar only spills over', async () => {
    // A July calendar draws the last days of June in the same grid, and they are tapped by somebody entering a payment made at the end of the month. A control that read the month off the page rather than off the day would put every one of them five weeks out.
    const picked: Array<string> = []

    render(<Day label="Agreed on" value="2026-07-16" onPick={(day) => picked.push(day)} />)

    await userEvent.click(screen.getByRole('button', { name: 'Agreed on: 16/07/2026' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sunday, June 28th, 2026' }))

    expect(picked).toEqual(['2026-06-28'])
  })

  it('closes behind the day that was tapped', async () => {
    render(<Day label="Agreed on" value="2026-07-16" onPick={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Agreed on: 16/07/2026' }))
    expect(screen.getByRole('grid')).toBeTruthy()

    await userEvent.click(await screen.findByRole('button', { name: 'Saturday, July 11th, 2026' }))

    // A calendar left open over the next question is two actions where there was one, and the second is the one forgotten with a cheque book in the other hand.
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('reaches a day in another month, which is what the arrows are for', async () => {
    // A payment made in March entered in July. Nothing in the tests of the screens pages, because the helper they use refuses to -- so if the arrows stopped working this is the only place it would show.
    const picked: Array<string> = []

    render(<Day label="Agreed on" value="2026-07-16" onPick={(day) => picked.push(day)} />)

    await userEvent.click(screen.getByRole('button', { name: 'Agreed on: 16/07/2026' }))
    await userEvent.click(screen.getByRole('button', { name: 'Go to the Previous Month' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Tuesday, June 16th, 2026' }))

    expect(picked).toEqual(['2026-06-16'])
  })

  it('opens on the month of the day it is holding rather than on this one', async () => {
    // A stage billed last March is edited from last March. Opening on today makes somebody page backwards to a month the control already knew.
    render(<Day label="Agreed on" value="2025-03-09" onPick={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Agreed on: 09/03/2025' }))

    expect(screen.getByRole('grid').getAttribute('aria-label')).toContain('March 2025')
  })
})
