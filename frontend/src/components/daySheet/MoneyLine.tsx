import { groupWhileTyping } from '~shared/money'

// The amount is the one thing on this screen worth looking at, so it is set in the display face at the size of a headline.

// A phone keyboard opens on digits, and the commas arrive as they are typed rather than when the payment is saved.
export function MoneyLine({
  value,
  onChange,
  problem,
}: {
  value: string
  onChange: (typed: string) => void
  problem?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">How much</span>
      <div className="border-border focus-within:border-primary flex items-baseline gap-2 border-b-2 transition-colors">
        <span className="text-muted-foreground font-display text-2xl leading-none">Rs</span>
        <input
          value={value}
          onChange={(event) => onChange(groupWhileTyping(event.target.value))}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label="How much"
          className="text-foreground placeholder:text-muted-foreground/40 font-display w-full min-w-0 border-0 bg-transparent py-1 text-[2.75rem] leading-tight outline-none"
        />
      </div>
      {problem ? <span className="text-destructive text-sm">{problem}</span> : null}
    </label>
  )
}
