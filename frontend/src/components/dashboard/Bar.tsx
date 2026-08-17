import type { CSSProperties } from 'react'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'

// One row of a bar chart, drawn rather than charted: a name, a length, and the figure it stands for.

// Written once because the Dashboard has two of these and they were not the same thing. `Spent by trade` said the figure on every row and `Invested by month` was a recharts bar chart with no number on it anywhere -- four bars, an axis of months, and the amount readable only through a hover tooltip. On a phone there is no hover, and tap-and-hold is a gesture nobody discovers. The two sat one above the other on the screen he opens first, which made the difference between them worse rather than easier to miss.

// The row that squeezed `Rs` in `MoneyLine` is this exact shape: a fixed label, a flexible track, a fixed figure. Done deliberately here, with both ends refusing to give way, because the middle is the only part that should.
export function Bar({
  label,
  paisa,
  largest,
  paint,
  tone,
}: {
  label: string
  paisa: number
  /** What the longest bar in this whole chart stands for. Measured against the largest rather than against a total, so the second bar is readable when the first is most of the money -- and handed in rather than worked out per row, because two charts scaled to two different largests cannot be compared with each other. */
  largest: number
  /** The bar's own colour, as a CSS value. A class will not do: one of these is a `color-mix` that carries a strength rather than a hue. */
  paint: string
  /** The figure's colour, as a class, and separate from the bar's on purpose. A bar may be a 45% mix and still read; the same value as text would not. */
  tone: string
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-foreground w-28 shrink-0 truncate text-sm sm:w-40">{label}</span>

      {/* The only part allowed to give way. A track that cannot shrink pushes the figure off a phone. */}
      <span className="bg-hairline h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
        <span
          // Tagged for the camera. What waits for a screen to stop moving used to measure `.recharts-bar-rectangle`, which was a claim about a library rather than about this app -- so the day recharts left, the wait would have gone on passing while measuring nothing at all.
          data-bar=""
          className="block h-full rounded-full"
          // Drawn rather than classed: a proportion is a number, and there is no class for "sixty-three percent of whatever this is".
          style={{ width: `${across(paisa, largest)}%`, background: paint } as CSSProperties}
        />
      </span>

      <Figure className={`${tone} w-24 shrink-0 text-right text-sm sm:w-32`}>{formatPaisa(paisa)}</Figure>
    </li>
  )
}

// A floor of 2%, so a row that is a real amount is a visible mark rather than nothing. Zero stays zero: a bar for money that has not moved is a bar saying something happened.
export function across(paisa: number, largest: number): number {
  if (largest <= 0 || paisa <= 0) {
    return 0
  }

  return Math.max(2, Math.round((paisa / largest) * 100))
}
