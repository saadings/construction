import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import { isCalendarDate } from '~shared/calendarDate'

// Choosing a day is two acts now rather than one. `<Line type="date" />` took a value and a test could set it; `Day` is opened and then tapped, which is also what somebody does with their thumb.

// Written once for the same reason `pick` is: a dozen tests across the screens do it, and copies of it drift the day the control changes again.

// The control names itself with the day it is holding on the end -- "Agreed on: 4 Jul 2026" -- so it cannot be found by the label alone. Matched on the words before the colon, which is the part a screen chose.

// How long to wait for the calendar after the control is opened, chosen the way `pick` chooses its own: a timeout is only paid when the wait fails, so being generous costs a passing suite nothing and costs a stuck one a few seconds of patience. This machine runs two sessions at once.
const LONG_ENOUGH_TO_BE_ABOUT_THE_CALENDAR = 5_000

/** What react-day-picker calls a day out loud: "Saturday, July 11th, 2026", and ", selected" on the one already chosen. */
function asItIsAnnounced(day: Date): RegExp {
  return new RegExp(`^${format(day, 'EEEE, MMMM do, yyyy')}(, selected)?$`)
}

/** Tap a day on the calendar a screen asks for under `label`. The day must be in the month the calendar opens on, which is the one the control is already holding. */
export async function chooseTheDay(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  day: string
): Promise<void> {
  if (!isCalendarDate(day)) {
    throw new Error(`${day} is not a day, so no calendar can be asked for it.`)
  }

  const [year, month, date] = day.split('-').map(Number)
  const wanted = new Date(year, month - 1, date)

  await user.click(screen.getByRole('button', { name: (name) => name.startsWith(`${label}: `) }))

  const grid = await screen.findByRole('grid', {}, { timeout: LONG_ENOUGH_TO_BE_ABOUT_THE_CALENDAR })
  const shown = grid.getAttribute('aria-label') ?? ''

  // Said rather than left to fail on a missing cell. A day in another month is simply not drawn, and "unable to find a button" is a sentence about the wrong thing entirely.
  if (!shown.includes(format(wanted, 'MMMM yyyy'))) {
    throw new Error(
      `The calendar under "${label}" opened on ${shown || 'no month it will say'}, and ${day} is not in it. It opens on the day the control is holding, so set that day or the clock first.`
    )
  }

  await user.click(await screen.findByRole('button', { name: asItIsAnnounced(wanted) }))
}
