import { Link, useRouterState } from '@tanstack/react-router'

import { cn } from '../../lib/utils'
import { DESTINATIONS } from './destinations'

// The strip he drew: every section in one scrolling row, under the header, below 768.

// It was built, then deleted. My argument was that two navigations for one list is how a destination comes to exist in one and not the other, and that a scroller hides its tail. Both are true and neither was mine to act on -- he drew this and he asked for the sidebar **as well**, which I read as *instead*.

// So both exist now: the strip is on the screen, the sheet opens from the corner beside it, and the one thing that made the argument real is answered by the list they share. `DESTINATIONS` is read by all three shapes, so a section cannot be in one and missing from another.

// Sticky at `top-16`, which is the header's own height. A number tied to another element's height is the shape this repo has a rule against -- it is here because the drawing says it and because the header is `h-16` four lines away, not because it was guessed.
const HOW_TALL_THE_HEADER_IS = 'top-16'

export function TheStrip() {
  const here = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav
      aria-label="Sections"
      className={cn(
        'border-border bg-background/95 sticky z-10 flex gap-1 overflow-x-auto border-b px-4 py-2 backdrop-blur-sm md:hidden',
        HOW_TALL_THE_HEADER_IS
      )}
    >
      {DESTINATIONS.map((destination) => {
        // The same rule every shape of this nav marks by: everything under `/more` is Settings, and only `/` itself is Sites.
        const on = destination.to === '/' ? here === '/' : here.startsWith(destination.to)

        return (
          <Link
            key={destination.to}
            to={destination.to}
            // The same marker the rail's rows carry, so what measures whether a thumb can hit a nav control measures these too. It is the repo's own attribute rather than a generator's, which is the whole reason that sweep can see anything.
            data-nav-row=""
            data-here={on || undefined}
            className={cn(
              'text-muted-foreground shrink-0 rounded-md px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
              // 44 under a thumb, which the drawing's `py-2` on a 13px line does not reach. The height is this app's floor and the padding either side is the drawing's.
              'flex min-h-11 items-center pointer-fine:min-h-9',
              'data-[here]:bg-primary data-[here]:text-primary-foreground'
            )}
          >
            {destination.label}
          </Link>
        )
      })}
    </nav>
  )
}
