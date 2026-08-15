// What a Tailwind size class comes to in pixels, at this app's root size. Only the ones a control could plausibly wear are here: a name not in this map and not an arbitrary size is not a size at all -- `text-right`, `text-muted-foreground` and `text-balance` all begin the same way.
const AS_PIXELS: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
  'text-5xl': 48,
  'text-6xl': 60,
}

/** A size written out rather than named: `text-[2.75rem]`, `text-[17px]`. */
function saidOutright(name: string): number | null {
  const written = /^text-\[([\d.]+)(rem|px)\]$/.exec(name)
  if (written === null) return null

  return written[2] === 'rem' ? Number(written[1]) * 16 : Number(written[1])
}

function asPixels(name: string): number | null {
  return name in AS_PIXELS ? AS_PIXELS[name] : saidOutright(name)
}

// Two answers rather than one, because that is the shape of the defect: shadcn's input is `text-base md:text-sm`, so a size written without its `md:` twin is the size somebody sees on one and not on the other. Read after `cn` has merged, so a class that lost is already gone.

/** What a class list really sets a control to, on a phone and on a desk. */
export function whatSizeItComesTo(classes: string): { onAPhone: number | null; onADesk: number | null } {
  const written = classes.split(/\s+/).filter((name) => name !== '')

  const base = written.filter((name) => !name.includes(':')).map(asPixels)
  const desk = written.filter((name) => name.startsWith('md:')).map((name) => asPixels(name.slice('md:'.length)))

  // The last one wins, the way the stylesheet decides it. There should be at most one of each once `cn` has merged, and taking the last rather than the first is what makes that assumption harmless if it ever fails.
  const last = (sizes: Array<number | null>) => sizes.filter((size) => size !== null).at(-1) ?? null
  const onAPhone = last(base)

  return { onAPhone, onADesk: last(desk) ?? onAPhone }
}

// What actually decides a box's size, which is not always written on the box. A `ComboboxInput` hands its `className` to the group it wraps, so the only way to reach the input is a descendant selector on an ancestor -- and a descendant selector beats the utility it is undoing on specificity, so it comes last here for the same reason it wins in the stylesheet.
const REACHING_IN = /^\[&_(input|textarea)\]:(.+)$/

/** Every class that decides this control's size: its own, then whatever an ancestor reaches in to say. */
export function whatDecidesTheSizeOf(control: Element): string {
  const reaching: Array<string> = []

  for (let above = control.parentElement; above !== null; above = above.parentElement) {
    for (const name of above.className.split(/\s+/)) {
      const inward = REACHING_IN.exec(name)
      if (inward !== null && control.tagName.toLowerCase() === inward[1]) {
        reaching.push(inward[2])
      }
    }
  }

  return [control.className, ...reaching].join(' ')
}
