import { asAShortMonth, asTheMonthInFull } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Panel } from '../shell/Panel'
import { across } from './Bar'

// `Money in and out` as he drew it: six months, a pair of columns each, a legend, and a sentence underneath saying which month was the heaviest.
export type Month = { month: string; inPaisa: number; outPaisa: number }

// How tall the columns stand. His number, and it is a fixed height on purpose -- columns measured against a share of the viewport are a different chart on a phone and on a desk.
const AS_TALL_AS_HE_DREW = 'h-[168px]'

// This replaced a chart splitting what came in into the partners' own money and what the houses brought. That split is real and it is not what he drew here; it is on `Reports`, and the tile beside this one still says how much of what came in was his.

// What it costs: his columns carry no figure. `Bar` exists because the chart before it was readable only through a hover tooltip, which on a phone is a tap-and-hold nobody discovers -- so the amounts are said in the sentence under the chart and in each column's own label, and the fact that a person cannot read a value off the columns themselves is on the list going back to him rather than quietly fixed against the drawing.
export function InAndOut({ months }: { months: Array<Month> }) {
  if (months.length === 0) {
    return null
  }

  // One scale across both series and every month, so any column is comparable with any other. Two series each measured against their own largest would draw a month's outgoings as tall as its receipts when they were a tenth of them.
  const largest = Math.max(...months.flatMap((one) => [one.inPaisa, one.outPaisa]))
  const heaviest = months.reduce((most, one) =>
    one.inPaisa + one.outPaisa > most.inPaisa + most.outPaisa ? one : most
  )

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="leading-none font-semibold">Money in and out</h2>
          <p className="text-muted-foreground text-[0.8125rem]">Last {months.length} months, all sites</p>
        </div>

        {/* Brass against green, which is the one pair this app has measured as distinguishable -- 30.1 apart by CIEDE2000, further than either is from the refusal colour. The two greens on the chart this replaced needed their names written over their own rows for exactly the reason this does not. */}
        <div className="text-muted-foreground flex items-center gap-3 text-[0.75rem]">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="bg-green size-2.5 rounded-[2px]" />
            In
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="bg-brass size-2.5 rounded-[2px]" />
            Out
          </span>
        </div>
      </div>

      <ul aria-label="Money in and out" className={`flex items-end gap-4 ${AS_TALL_AS_HE_DREW}`}>
        {months.map((one) => (
          <li
            key={one.month}
            className="flex h-full flex-1 flex-col justify-end gap-1.5"
            // Both figures on the month they belong to. The columns say them in no other way, so this is the only place a person not reading heights off a picture can get them.
            aria-label={`${asTheMonthInFull(one.month)}: ${formatPaisa(one.inPaisa)} in, ${formatPaisa(one.outPaisa)} out`}
          >
            <span className="flex flex-1 items-end gap-1">
              {/* Tagged for the camera, like every other bar in this app. What waits for a screen to stop moving measures these, and it measures both dimensions because these carry their length in their height rather than their width. */}
              <span
                data-bar=""
                className="bg-green/80 flex-1 rounded-t-sm"
                style={{ height: `${String(across(one.inPaisa, largest))}%` }}
              />
              <span
                data-bar=""
                className="bg-brass/80 flex-1 rounded-t-sm"
                style={{ height: `${String(across(one.outPaisa, largest))}%` }}
              />
            </span>

            <span className="text-faint text-center font-mono text-[0.6875rem]">{asAShortMonth(one.month)}</span>
          </li>
        ))}
      </ul>

      {/* His own sentence under the chart, saying which month stood out. He wrote why -- a client payment and the steel order that followed it -- which is a thing only a person knows; this says which month and both its figures, which is what the columns cannot be read for. */}
      {largest === 0 ? null : (
        <p className="text-muted-foreground border-border border-t pt-3 text-[0.8125rem]">
          {asTheMonthInFull(heaviest.month)} was the heaviest month either way —{' '}
          <Figure>{formatPaisa(heaviest.inPaisa)}</Figure> in and <Figure>{formatPaisa(heaviest.outPaisa)}</Figure> out.
        </p>
      )}
    </Panel>
  )
}
