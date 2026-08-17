import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

// The shapes Nauman's redesign draws every screen out of, written once so the screens it does not draw are built from the same pieces rather than from a reading of them.

// Sixteen screens have no drawing at all -- the partner three, `HowItLooks`, and fourteen sections of houses and settings -- and the risk there is not that they look wrong, it is that they look *nearly* right in a way nobody can name. So the language is a component rather than a class list somebody copies.

/** A card: what every block on a drawn screen sits in. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border-border bg-card rounded-xl border shadow-sm', className)}>{children}</div>
}

// A table inside a card, which is the drawn treatment for every list of figures: the card holds the scroll so a wide table never pushes the page sideways, and the rule under the header belongs to the card rather than to the first row.

/** A card holding a table, with the sideways scroll kept inside it. */
export function TablePanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Panel className={cn('w-full overflow-x-auto', className)}>
      <div className="flex min-w-full flex-col">{children}</div>
    </Panel>
  )
}

// A figure the screen is about, carried on a card of its own. Every drawn screen puts its totals in these rather than in a strip above the table, so a figure is a thing on the page rather than a column of a table nobody drew.

// Written once because the second screen wanted it: the caption size, the letter-spacing and the figure size are the drawing, and a copy of them is a copy that drifts. It renders `dt`/`dd`, so what holds a row of these is a `dl`.

/** One figure on a card, with what it is above it. */
export function Tile({
  label,
  tone,
  beneath,
  children,
}: {
  label: string
  tone?: string
  /** A sentence under the figure, where the design puts what a figure means rather than leaving it to be worked out. */
  beneath?: ReactNode
  children: ReactNode
}) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <dt className="text-faint text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">{label}</dt>
      <dd className={cn('text-[1.6875rem] leading-none', tone ?? 'text-foreground')}>{children}</dd>
      {beneath === undefined ? null : <dd className="text-muted-foreground text-[0.8125rem]">{beneath}</dd>}
    </Panel>
  )
}

// A word about a row rather than a figure in it: a partner's role, a house's stage, whether a bill is late. The design gives each of the three meaning colours a tinted plane to sit on, so the colour says which and the tint says it is a state.
export type PillTone = 'green' | 'brass' | 'refusal' | 'quiet'

const TONES: Record<PillTone, string> = {
  green: 'bg-green-tint text-green',
  brass: 'bg-brass-tint text-brass',
  refusal: 'bg-refusal-tint text-destructive',
  // Nothing is being said about money: a count, a stage, a plain label.
  quiet: 'bg-muted text-muted-foreground',
}

export function Pill({
  tone = 'quiet',
  className,
  children,
}: {
  tone?: PillTone
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-[0.6875rem] font-medium', TONES[tone], className)}>
      {children}
    </span>
  )
}

// The heading over a block, with the count beside it. Drawn as a row so a heading and what it is counting cannot drift apart the way a heading and a separate line above a list do.
export function Heading({
  said,
  count,
  beside,
  children,
}: {
  said: string
  /** How many rows are under it, said as a pill rather than in the words, so the words stay the name of the thing. */
  count?: number
  beside?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <span className="flex items-center gap-2.5">
        <h2 className="leading-none font-semibold">{said}</h2>
        {count === undefined ? null : <Pill className="font-mono">{count}</Pill>}
        {children}
      </span>
      {beside}
    </div>
  )
}
