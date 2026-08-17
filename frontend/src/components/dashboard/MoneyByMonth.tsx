import { Link } from '@tanstack/react-router'

import { Bar } from './Bar'

// What came in, month by month, with the partners' own money kept apart from what the houses brought in.

// The two are never added into one bar. A single bar holding both says a house is doing well the moment somebody funds it, which is the mistake the whole profit split is built to avoid.

// It was a recharts bar chart until now, and the reason it is not one any more is that it had no number on it. Four bars, an axis of months, a legend -- and the amount readable only through a hover tooltip, which on a phone means tap-and-hold, which nobody discovers. `Spent by trade` sits directly above it saying its figure on every row, so the two were on one screen disagreeing about whether a chart says what it is worth.
export type Month = { month: string; ownMoneyPaisa: number; broughtInPaisa: number }

// Both of these are money coming in. `ownMoney` was brass, which is the colour this app uses for money going out -- so half the bars on a chart headed `Invested` were painted as money leaving, on the screen he opens first.

// The difference between them is not a direction, so it is not carried by a second colour. It is the same green at 45% over the page, which is 29.6 apart from the solid one by CIEDE2000 -- as far apart as brass and green are, which is the pair this app already tells apart.

// And it is no longer carried by colour alone, which it was: a legend under a chart is two swatches and two words, and a person who cannot separate two greens reads two bars a month with no way to tell which is which. Each series is a group with its name written over it now, so the colour agrees with a word rather than standing in for one.
export const HOW_IT_IS_DRAWN: Record<'broughtIn' | 'ownMoney', { label: string; color: string }> = {
  broughtIn: { label: 'Brought in', color: 'var(--green)' },
  ownMoney: { label: 'Own funds', color: 'color-mix(in srgb, var(--green) 45%, var(--ground))' },
}

/** `2026-04` said the way somebody says it, without building a date to find out. */
export function asAMonth(month: string): string {
  const said = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [year, at] = month.split('-')
  const which = Number(at)

  // Anything that is not a month is said as it stands rather than as the wrong month.
  if (!Number.isInteger(which) || which < 1 || which > 12) {
    return month
  }

  return `${said[which - 1]} ${year.slice(2)}`
}

// A house takes a year or two, so this list grows to twenty-odd rows and a dashboard is a summary. Cut here rather than in the query, which other things read and which the whole of `Money in` is drawn from.

/** How many months of it the summary shows before the rest is somebody else's screen. */
export const A_SUMMARY = 6

// `Invested by month` rather than `Invested`, which the tile above already says. Both came out of one row of the rename -- `Come in` and `What came in` were different enough to tell apart and `Invested` twice is not -- and they are not the same figure: the tile is everything that has come in, this is that split by month and by where it came from.

// Found in the picture rather than by a test. Nothing asserts two headings on one screen are different, and both are correct on their own.
export function MoneyByMonth({ months }: { months: Array<Month> }) {
  if (months.length === 0) {
    return null
  }

  const shown = months.slice(-A_SUMMARY)

  // One scale across both series and every month shown, so a bar is comparable with any other bar here. Two groups each measured against their own largest would draw `Own funds` as long as `Brought in` in a month where it was a tenth of it.
  const largest = Math.max(...shown.flatMap((one) => [one.broughtInPaisa, one.ownMoneyPaisa]))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">Invested by month</h2>

        {/* Said only when there is something being left out. A permanent line about the last six months is a line about nothing for the first five. */}
        {months.length > A_SUMMARY ? (
          <p className="text-muted-foreground text-sm">
            The last {A_SUMMARY} months.{' '}
            <Link to="/money-in" className="text-foreground underline-offset-4 hover:underline">
              All of it
            </Link>
          </p>
        ) : null}
      </div>

      {/* A group for each series rather than a pair of bars per month, so the name is written once above the rows it belongs to and the months underneath read as a run. A month's two bars are apart on the page and still on one scale, which is what makes them comparable. */}

      {/* Side by side where there is room, which puts a month's two bars level with each other and makes that comparison a glance rather than a scroll. Stacked on a phone, where two columns would leave a track narrower than the figure beside it. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(['broughtIn', 'ownMoney'] as const).map((series) => (
          <div key={series} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-sm">{HOW_IT_IS_DRAWN[series].label}</h3>

            <ul aria-label={HOW_IT_IS_DRAWN[series].label} className="flex flex-col gap-2.5">
              {shown.map((one) => (
                <Bar
                  key={one.month}
                  label={asAMonth(one.month)}
                  paisa={series === 'broughtIn' ? one.broughtInPaisa : one.ownMoneyPaisa}
                  largest={largest}
                  paint={HOW_IT_IS_DRAWN[series].color}
                  tone="text-green"
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
