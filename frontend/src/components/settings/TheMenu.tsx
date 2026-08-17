import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

// More was four unrelated things in one scroll: who may sign in, how it looks, the list a day sheet picks from, and the accounts money leaves. Each with its own form, stacked, and none of them named after anything on a screen he uses.

// So it is a menu, and every place behind it is named after the question it answers on a form. He was looking at the day sheet's `WHAT FOR` and could not find the list it picks from, because the list was called "what money is spent on" -- a true description, and not the words in front of him.
export type WhereToGo = {
  to: string
  name: string
  what: string
  /** What is there now, so a menu of five does not have to be opened five times to find one. A reading still coming hands in the shape of the figure rather than a nought, which would read as a fact. */
  now: ReactNode
}

// One bar the width of a short figure. The row is already drawn and only its count is late, so what is held open is the count and not the row.
export function TheCountWaiting() {
  return (
    <WhileWaiting what="Counting what is on each list">
      <Skeleton className="h-3 w-10" />
    </WhileWaiting>
  )
}

export function TheMenu({ places }: { places: Array<WhereToGo> }) {
  return (
    <Page title="More">
      {/* One grid for the whole list rather than one per row. Each row used to size its own `auto` track, so three rows put their count at 379 and `Auto` put its at 421 -- a column that moves because of what happens to be in it. The tracks are declared once here and every row takes them through `subgrid`, so the widest count in the list decides the column and each row keeps its own box for the hover and the link. */}
      <ul className="border-hairline grid grid-cols-[minmax(0,1fr)_auto] border-t">
        {places.map((place) => (
          <li key={place.to} className="border-hairline col-span-2 grid grid-cols-subgrid border-b">
            <Link
              to={place.to}
              className="hover:bg-row-hover col-span-2 grid grid-cols-subgrid items-center gap-4 px-1 py-4 transition-colors"
            >
              <span className="min-w-0">
                <span className="text-foreground block text-[0.9375rem] font-medium">{place.name}</span>
                {/* Given up first on a narrow screen: the name has to carry it alone, which is another reason the naming matters more than the layout. */}
                <span className="text-muted-foreground mt-0.5 hidden max-w-prose text-sm sm:block">{place.what}</span>
              </span>

              {/* Pushed to the right of the shared track. Sharing the track fixes where the column starts; without this the short counts sit at its left and the chevron -- the mark that says the row opens -- is the thing left ragged, which is the half of the defect that survives the first fix. */}
              <span className="text-faint flex shrink-0 items-center justify-end gap-3 font-mono text-sm">
                {place.now}
                <span aria-hidden className="text-base">
                  ›
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}
