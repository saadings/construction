import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'
import type { ChartConfig } from '../ui/chart'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '../ui/chart'

// What came in, month by month, with the partners' own money in a different colour from what the houses brought in. This one is a chart rather than bars: it is two series over time, and reading a trend off a list of numbers is the thing a chart is actually for.

// The two are never stacked into one bar. A single bar holding both says a house is doing well the moment somebody funds it, which is the mistake the whole profit split is built to avoid.
export type Month = { month: string; ownMoneyPaisa: number; broughtInPaisa: number }

// Both of these are money coming in. `ownMoney` was brass, which is the colour this app uses for money going out -- so half the bars on a chart headed `What came in` were painted as money leaving, on the screen he opens first.

// The difference between them is not a direction, so it is not carried by a second colour. It is the same green at 45% over the page, which is 29.6 apart from the solid one by CIEDE2000 -- as far apart as brass and green are, which is the pair this app already tells apart. Read from the config by the bars and by the legend alike, so the swatch cannot drift from what it labels.
export const HOW_IT_IS_DRAWN = {
  broughtIn: { label: 'Brought in', color: 'var(--green)' },
  ownMoney: { label: 'Your own money', color: 'color-mix(in srgb, var(--green) 45%, var(--ground))' },
} satisfies ChartConfig

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

export function MoneyByMonth({ months }: { months: Array<Month> }) {
  if (months.length === 0) {
    return null
  }

  const drawn = months.map((one) => ({
    month: asAMonth(one.month),
    broughtIn: one.broughtInPaisa / 100,
    ownMoney: one.ownMoneyPaisa / 100,
  }))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">What came in</h2>

      <ChartContainer config={HOW_IT_IS_DRAWN} className="h-56 w-full">
        <BarChart accessibilityLayer data={drawn}>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip
            // In the same face every other figure in the app is set in. A tooltip is where somebody reads the actual number, so it lines up like the rest.
            content={<ChartTooltipContent formatter={(value) => <Figure>{formatPaisa(Number(value) * 100)}</Figure>} />}
            cursor={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {/* Side by side rather than stacked, so the two are compared rather than added. */}
          <Bar dataKey="broughtIn" fill="var(--color-broughtIn)" radius={3} />
          <Bar dataKey="ownMoney" fill="var(--color-ownMoney)" radius={3} />
        </BarChart>
      </ChartContainer>
    </section>
  )
}
