import { TriangleAlert } from 'lucide-react'
import { asADayAndMonth } from '~shared/calendarDate'

import { inWords } from '../inWords'
import { Figure } from '../shell/Page'
import { Pill } from '../shell/Panel'

// The block at the top of his dashboard, above the figures: what he would want to be told before he goes looking.

// He drew three rows in it. Two of them cannot be answered by this ledger and are not invented here -- `3 supplier bills are past their due date` needs a due date on a bill, and `8-A, Phase 8 has passed its budget` needs an estimate on a site. Neither field exists. Both are on the list going back to him rather than being filled with something that looks like an answer.

// So one row is live: the days nothing was recorded on. It is the row a person can act on today, and it is the one that catches the failure this whole app is for -- a week of site payments living in somebody's head.
export type Attention = { quietDays: Array<string> }

/** How many days are named before the rest are counted. Three is a sentence; nine is a list nobody reads. */
const NAMED = 3

// `10 and 11 March` -- his own phrasing, with the month said once at the end where every day named is in it. A run crossing a month says both, because `30 and 1 June` is a date nobody can read.
export function theDaysNamed(days: Array<string>): string {
  const naming = days.slice(0, NAMED)
  const oneMonth = new Set(naming.map((day) => day.slice(0, 7))).size === 1
  const said = oneMonth
    ? naming.map((day, at) => (at === naming.length - 1 ? asADayAndMonth(day) : String(Number(day.slice(8, 10)))))
    : naming.map(asADayAndMonth)

  const rest = days.length - said.length
  if (rest > 0) {
    said.push(`${String(rest)} more`)
  }

  if (said.length === 1) return said[0]

  return `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}`
}

export function NeedsYourAttention({ what }: { what: Attention }) {
  const rows = what.quietDays.length === 0 ? 0 : 1

  // Absent rather than empty. A block headed `Needs your attention` holding nothing is a block saying something is wrong every day of a year when nothing is.
  if (rows === 0) {
    return null
  }

  const days = what.quietDays.length

  return (
    <section className="border-brass/30 bg-brass-tint flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert aria-hidden className="text-brass size-4 shrink-0" />
        <h2 className="text-sm font-semibold">Needs your attention</h2>
        <Pill tone="brass" className="font-mono">
          {rows}
        </Pill>
      </div>

      <ul className="divide-border flex flex-col divide-y">
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Nothing recorded on {theDaysNamed(what.quietDays)}.</span>{' '}
            <span className="text-muted-foreground">
              {inWords(days)} {days === 1 ? 'day' : 'days'} in the last week with no entries.
            </span>
          </span>

          {/* In digits, where the sentence beside it says the word. That is his own pairing -- `Two working days with no entries.` against `2 days` -- and it is the difference between a sentence and the figure the row is worth: this column holds `2,090,000` and `+11%` on his other two rows. */}

          {/* His row ends in an `Open daybook` button after this. The daybook is the next screen to be built and a row that goes nowhere is the dead end this app has already fixed once, so the button arrives with the screen rather than pointing at something else in the meantime. */}
          <Figure className="text-muted-foreground text-sm whitespace-nowrap">
            {days} {days === 1 ? 'day' : 'days'}
          </Figure>
        </li>
      </ul>
    </section>
  )
}
