import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { formatPaisa } from '~shared/money'

import { Figure, Page } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type SiteRow = {
  _id: string
  name: string
  stage: 'planning' | 'building' | 'finishing' | 'complete' | 'sold'
  builtForAClient: boolean
  spentPaisa: number
}

// The words a person would use for where a house has got to. "Complete" is what the schema calls it; "Finished" is what he calls it.
const STAGE: Record<SiteRow['stage'], string> = {
  planning: 'Planning',
  building: 'Building',
  finishing: 'Finishing',
  complete: 'Finished',
  sold: 'Sold',
}

// One row a house, and the columns line up because a house and its spending are read down the page rather than one at a time.

// The same markup at every width: a phone gets the name and the figure, a desk gets the two columns between them as well. Two renderings of one list is how they drift.

// One grid for the whole list, and every row takes its columns from it. Written per row, each row sized its own `auto` track to its own figure, so a house with nothing spent on it put `Spent` at 469 while the others were at 372 and 383 -- the only list here whose *desk* grid ended in `auto`, which is why this one moved at 1280 as well as on a phone.
const GRID = 'grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]'

/** A row: it takes the columns above rather than declaring any. */
const ROW = 'col-span-full grid grid-cols-subgrid items-baseline gap-x-4 gap-y-1'

/** Everything between the grid and a row -- a list, a list item -- which has to pass the columns down rather than stop them. */
const PASSES_THEM_DOWN = 'col-span-full grid grid-cols-subgrid'

export function SitesList({ sites }: { sites: Array<SiteRow> }) {
  return (
    <Page title="Sites" beside={<StartOne className="hidden sm:inline-flex" />}>
      {sites.length === 0 ? (
        <p className="text-muted-foreground py-10">No houses yet. Start one and the spending goes under it.</p>
      ) : (
        <div className={GRID}>
          <div
            className={`${ROW} text-faint border-border hidden border-b pb-2 text-[0.75rem] tracking-[0.06em] uppercase sm:grid`}
          >
            <span>House</span>
            <span>Stage</span>
            <span>Whose</span>
            <span className="text-right">Spent</span>
          </div>

          <ol className={`${PASSES_THEM_DOWN} divide-hairline divide-y`}>
            {sites.map((site) => (
              <li key={site._id} className={PASSES_THEM_DOWN}>
                <Link
                  to="/sites/$siteId"
                  params={{ siteId: site._id }}
                  className={`${ROW} hover:bg-row-hover -mx-3 rounded-md px-3 py-3.5 transition-colors`}
                >
                  <span className="text-foreground min-w-0 truncate text-[1.0625rem]">{site.name}</span>

                  <span className="text-muted-foreground order-last col-span-2 text-sm sm:order-none sm:col-span-1">
                    {STAGE[site.stage]}
                  </span>
                  <span className="text-muted-foreground hidden text-sm sm:block">
                    {site.builtForAClient ? 'For a client' : 'Ours to sell'}
                  </span>

                  {/* Brass, because it is money going out. Nothing else on this screen is coloured at all. */}
                  <Figure className="text-brass text-right text-lg">{formatPaisa(site.spentPaisa)}</Figure>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <StartOne className="fixed right-5 bottom-5 z-10 size-14 justify-center rounded-full shadow-lg sm:hidden" short />
    </Page>
  )
}

// The same page, the same grid, the same row height, with nothing in it yet. Built from `ROW` alongside the list itself so the two cannot drift into different shapes and make the screen jump when the houses arrive.
export function SitesListWaiting() {
  return (
    <Page title="Sites" beside={<StartOne className="hidden sm:inline-flex" />}>
      <WhileWaiting what="Getting your houses">
        <div className={GRID}>
          <div className={`${ROW} border-border hidden border-b pb-2 sm:grid`}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>

          <div className={`${PASSES_THEM_DOWN} divide-hairline divide-y`}>
            {/* Three, because a house being built for somebody is a short list and a screenful of grey bars is a worse promise than a short one. */}
            {[0, 1, 2].map((row) => (
              <div key={row} className={`${ROW} py-3.5`}>
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="order-last col-span-2 h-4 w-20 sm:order-none sm:col-span-1" />
                <Skeleton className="hidden h-4 w-24 sm:block" />
                <Skeleton className="ml-auto h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </WhileWaiting>
    </Page>
  )
}

// One button in two shapes: beside the heading where there is room, and under the thumb where there is not.
function StartOne({ className, short = false }: { className?: string; short?: boolean }) {
  return (
    <Link
      to="/sites/new"
      aria-label="Start a house"
      className={`bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-medium ${className ?? ''}`}
    >
      <Plus className="size-5" aria-hidden />
      {short ? null : 'Start a house'}
    </Link>
  )
}
