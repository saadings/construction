import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'

// Where the money went, by trade. Bars rather than a chart: seven rows with a name, a length and a figure is what a chart of this would draw anyway, and a charting library asked to do it puts the trade names in an axis that has to be given a fixed width -- which is unreadable on a phone, where he is.

// The row that squeezed `Rs` in `MoneyLine` is this exact shape: a fixed label, a flexible track, a fixed figure. Done deliberately here, with both ends refusing to give way, because the middle is the only part that should.
export type Spending = { tradeId: string | null; name: string; paisa: number }

export function WhereItWent({ spending }: { spending: Array<Spending> }) {
  if (spending.length === 0) {
    return null
  }

  // Measured against the largest rather than against the total, so the second bar is readable when the first is most of the money.
  const largest = Math.max(...spending.map((one) => one.paisa))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">Spent by trade</h2>

      <ul aria-label="Spent by trade" className="flex flex-col gap-2.5">
        {spending.map((one) => (
          <li key={one.tradeId ?? 'the rest'} className="flex items-center gap-3">
            <span className="text-foreground w-28 shrink-0 truncate text-sm sm:w-40">{one.name}</span>

            {/* The only part allowed to give way. A track that cannot shrink pushes the figure off a phone. */}
            <span className="bg-hairline h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
              <span
                className="bg-brass block h-full rounded-full"
                // Drawn rather than classed: a proportion is a number, and there is no class for "sixty-three percent of whatever this is".
                style={{ width: `${largest === 0 ? 0 : Math.max(2, Math.round((one.paisa / largest) * 100))}%` }}
              />
            </span>

            <Figure className="text-brass w-24 shrink-0 text-right text-sm sm:w-32">{formatPaisa(one.paisa)}</Figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
