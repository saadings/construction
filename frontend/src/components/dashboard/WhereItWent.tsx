import { asTheMonthInFull } from '~shared/calendarDate'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import { Panel } from '../shell/Panel'
import { Bar } from './Bar'

// Where the money went, by category. Bars rather than a chart: eight rows with a name, a length and a figure is what a chart of this would draw anyway, and a charting library asked to do it puts the names in an axis that has to be given a fixed width -- which is unreadable on a phone, where he is.
export type Spending = { tradeId: string | null; name: string; paisa: number }

// How many rows keep the full-strength brass. His drawing fades the smaller half to `bg-brass/60`, which says nothing on its own and reads as a ranking -- the four that took the money and the tail behind them.
const AT_FULL_STRENGTH = 4

const STRONG = 'color-mix(in srgb, var(--brass) 85%, transparent)'
const FADED = 'color-mix(in srgb, var(--brass) 60%, transparent)'

// The month, not the whole ledger. His heading says `By category, March 2025`, and where the money has gone since the beginning is a different question with its own screen.
export function WhereItWent({ spending, month }: { spending: Array<Spending>; month: string }) {
  const total = spending.reduce((sum, one) => sum + one.paisa, 0)
  const largest = Math.max(0, ...spending.map((one) => one.paisa))

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="leading-none font-semibold">Where the money went</h2>
          <p className="text-muted-foreground text-[0.8125rem]">By category, {asTheMonthInFull(month)}</p>
        </div>

        {/* The total of the rows below it, in his top-right corner. It is what makes the rows checkable: a chart whose parts do not come to the figure beside them is a chart nobody can catch being wrong. */}
        <Figure className="text-muted-foreground text-sm">{formatPaisa(total)}</Figure>
      </div>

      {/* A month with nothing in it is a real month, and it happens on the first of every one of them. Said in a sentence rather than left as an empty card, which reads as a screen that failed to load. */}
      {spending.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing has gone out this month yet.</p>
      ) : (
        <ul aria-label="Where the money went" className="flex flex-col gap-2.5">
          {spending.map((one, at) => (
            <Bar
              key={one.tradeId ?? 'the rest'}
              label={one.name}
              paisa={one.paisa}
              largest={largest}
              paint={at < AT_FULL_STRENGTH ? STRONG : FADED}
              tone="text-foreground"
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}
