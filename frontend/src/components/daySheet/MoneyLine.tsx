import { groupWhileTyping } from '~shared/money'

import { useSaidOnceLeft } from '../form/Field'

// The amount is the one thing on this screen worth looking at, so it is set in the display face at the size of a headline.

// A phone keyboard opens on digits, and the commas arrive as they are typed rather than when the payment is saved.
export function MoneyLine({
  value,
  onChange,
  problem,
}: {
  value: string
  onChange: (typed: string) => void
  problem?: string | null
}) {
  // The same rule every other question follows: nothing is said until the eye has left the box.
  const { showing, onBlur } = useSaidOnceLeft(problem)

  return (
    <label className="flex flex-col gap-1.5" onBlur={onBlur}>
      <span className="text-muted-foreground text-[0.8125rem] font-medium tracking-[0.06em] uppercase">How much</span>
      <div className="border-border focus-within:border-primary flex items-baseline gap-2 border-b-2 transition-colors">
        {/* Never allowed to give up its width. It is two characters beside a box that asks for all of them, so flex took the space out of the label and broke `Rs` over two lines at desk width. */}
        <span className="text-muted-foreground font-display shrink-0 text-2xl leading-none">Rs</span>
        <input
          value={value}
          onChange={(event) => onChange(groupWhileTyping(event.target.value))}
          aria-invalid={showing || undefined}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label="How much"
          // `flex-1` says what is meant -- take what is left -- where `w-full` asks for the whole row and leaves its sibling to give way.
          className="text-foreground placeholder:text-muted-foreground/40 font-display min-w-0 flex-1 border-0 bg-transparent py-1 text-[2.75rem] leading-tight outline-none"
        />
      </div>
      {showing ? (
        <span role="alert" className="text-destructive text-sm">
          {problem}
        </span>
      ) : null}
    </label>
  )
}
