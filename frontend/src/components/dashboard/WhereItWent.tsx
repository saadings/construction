import { Bar } from './Bar'

// Where the money went, by trade. Bars rather than a chart: seven rows with a name, a length and a figure is what a chart of this would draw anyway, and a charting library asked to do it puts the trade names in an axis that has to be given a fixed width -- which is unreadable on a phone, where he is.
export type Spending = { tradeId: string | null; name: string; paisa: number }

export function WhereItWent({ spending }: { spending: Array<Spending> }) {
  if (spending.length === 0) {
    return null
  }

  const largest = Math.max(...spending.map((one) => one.paisa))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">Spent by trade</h2>

      <ul aria-label="Spent by trade" className="flex flex-col gap-2.5">
        {spending.map((one) => (
          <Bar
            key={one.tradeId ?? 'the rest'}
            label={one.name}
            paisa={one.paisa}
            largest={largest}
            paint="var(--brass)"
            tone="text-brass"
          />
        ))}
      </ul>
    </section>
  )
}
