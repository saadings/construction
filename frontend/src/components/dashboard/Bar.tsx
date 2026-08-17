import type { CSSProperties } from 'react'
import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'

// One row of a bar chart, drawn rather than charted: a name, a length, and the figure it stands for.

// It is his row now. The name sits against the bar it belongs to rather than out at the left margin, the track is `h-4` and squared off rather than a `h-2.5` capsule, and the three columns are the widths he drew. What was here before was the same row invented independently, which is the whole reason the deviation list exists.

// The figure's column is `auto` with his 84px as a floor rather than a fixed 84. A width that clips a figure turns 31,150,000 into a different, smaller number with nothing on the screen saying so, and that is the one failure this app has already shipped once.

// The row that squeezed `Rs` in `MoneyLine` is this exact shape: a fixed label, a flexible track, a fixed figure. Both ends refuse to give way here on purpose, because the middle is the only part that should.
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
  /** The bar's own colour, as a CSS value. A class will not do: his chart fades the smaller half of its rows, which is a strength rather than a hue. */
  paint: string
  /** The figure's colour, as a class, and separate from the bar's on purpose. A bar may be a faded mix and still read; the same value as text would not. */
  tone: string
}) {
  return (
    <li className="grid grid-cols-[6.875rem_minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-muted-foreground truncate text-right text-[0.8125rem]">{label}</span>

      {/* The only part allowed to give way. A track that cannot shrink pushes the figure off a phone. */}
      <span className="bg-muted h-4 min-w-0 overflow-hidden rounded-sm">
        <span
          // Tagged for the camera. What waits for a screen to stop moving used to measure `.recharts-bar-rectangle`, which was a claim about a library rather than about this app -- so the day recharts left, the wait would have gone on passing while measuring nothing at all.
          data-bar=""
          className="block h-full"
          // Drawn rather than classed: a proportion is a number, and there is no class for "sixty-three percent of whatever this is".
          style={{ width: `${String(across(paisa, largest))}%`, background: paint } as CSSProperties}
        />
      </span>

      <Figure className={`${tone} min-w-[5.25rem] text-right text-[0.8125rem]`}>{formatPaisa(paisa)}</Figure>
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
