import { Link } from '@tanstack/react-router'
import { asDayHeWrites } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Panel } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type OneEntry = {
  _id: string
  day: string
  amountPaisa: number
  category: string
  paidToName: string
}

export type WhatHasBeenPut = {
  rows: Array<OneEntry>
  /** How many payments the house has altogether, so a card showing five does not read as a house with five. */
  standing: number
}

// The drawn `Latest entries` card: the most recent payments on this house, with the way through to the sheet they were put down on.

// It shows and does not change. Every other list of payments in this app carries the control that takes one back out; this one is a glance, and what it offers instead is the screen where a payment can actually be corrected. Two places to remove the same row is how two people remove it twice.
export function LatestEntries({ siteId, what }: { siteId: string; what: WhatHasBeenPut | null | undefined }) {
  if (what === undefined) {
    return (
      <Panel className="flex flex-col gap-4 p-5">
        <WhileWaiting what="Getting the latest payments">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </WhileWaiting>
      </Panel>
    )
  }

  // The page around this has already said why it cannot answer. Saying it again in a card whose whole content is a list somebody cannot have is saying it in the wrong place.
  if (what === null) {
    return null
  }

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="leading-none font-semibold">Latest entries</h2>
          <p className="text-muted-foreground text-[0.8125rem]">
            {what.standing === 0
              ? 'Nothing has been put down on this house yet'
              : `${what.rows.length} of ${what.standing} payments on this site`}
          </p>
        </div>

        <Link
          to="/sites/$siteId/day"
          params={{ siteId }}
          className="text-brass shrink-0 py-3 -my-3 text-[0.8125rem] font-medium hover:underline"
        >
          Open daybook
        </Link>
      </div>

      {what.rows.length === 0 ? null : (
        <ul className="divide-border flex flex-col divide-y">
          {what.rows.map((entry) => (
            <li key={entry._id} className="flex items-center gap-4 py-2.5">
              <Figure className="text-faint w-14 shrink-0 text-[0.75rem]">{asDayHeWrites(entry.day)}</Figure>

              <span className="flex min-w-0 flex-col">
                <span className="text-foreground truncate text-sm font-medium">{entry.category}</span>
                <span className="text-muted-foreground truncate text-[0.75rem]">{entry.paidToName}</span>
              </span>

              {/* Brass is money going out, the same as everywhere else it is shown. */}
              <Figure className="text-brass ml-auto shrink-0 text-sm">{formatPaisa(entry.amountPaisa)}</Figure>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
