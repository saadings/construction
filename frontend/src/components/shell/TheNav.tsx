import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import type { Destination } from './destinations'
import { DESTINATIONS, GROUPS } from './destinations'

// The nav, in the two shapes he drew: a dark rail down the side of a desk, and a strip a phone scrolls sideways. It was shadcn's `Sidebar` -- a column that became a sheet behind a hamburger -- and the design replaces that outright.

// Neither shape decides where it is drawn -- `Shell` does. A component carrying its own `md:hidden` cannot be photographed at the width it hides at, and the rail is tapped on a tablet at 768 where the strip is already gone.

// Worth knowing rather than discovering: losing the sheet is his decision and losing the tap target is not. His strip is `py-2` at 13px, about 34px tall, and it is the only navigation a phone has -- which is the exact defect he reported when the rows were 32px. So the arrangement is his and the height is the app's.

/** What Clerk draws goes here, because Clerk needs a provider and the gallery must not have one. `Shell` passes the real control; the gallery passes something the same size and says so on the page. */
export function TheNav({ footer }: { footer: ReactNode }) {
  const above = DESTINATIONS.filter((destination) => destination.under === undefined)

  return (
    // Every colour by name. The rail is dark against warm paper in the light theme and that separation has to survive the dark one, where the ground comes up to meet it -- so the surface and its edge are two tokens rather than one, and neither is decided here.
    <aside className="bg-sidebar text-sidebar-foreground sticky top-0 flex h-dvh w-60 shrink-0 flex-col">
      <div className="px-5 pt-5 pb-4">
        <span className="font-display text-sidebar-foreground text-[22px] leading-none">Construction</span>
      </div>

      {/* Named, because a list of links with no name is a list of links. It was `Sections` in every shape this nav has had and it stays that, so nothing that could find it before has to learn a new word. */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        <ul aria-label="Sections" className="flex flex-1 flex-col gap-1">
          {above.slice(0, 1).map((destination) => (
            <Where key={destination.to} destination={destination} />
          ))}

          {GROUPS.map((group) => {
            const inside = DESTINATIONS.filter((destination) => destination.under === group)

            // A heading with nothing under it is a heading about nothing. Read off the destinations so a group cannot outlive its last row.
            return inside.length === 0 ? null : (
              <li key={group}>
                <h2 className="px-3 pt-5 pb-1 text-[10px] font-semibold tracking-[0.16em] uppercase opacity-40">
                  {group}
                </h2>
                <ul aria-label={group} className="flex flex-col gap-1">
                  {inside.map((destination) => (
                    <Where key={destination.to} destination={destination} />
                  ))}
                </ul>
              </li>
            )
          })}

          <li className="mt-auto flex flex-col gap-1 pt-6">
            <ul className="flex flex-col gap-1">
              {above.slice(1).map((destination) => (
                <Where key={destination.to} destination={destination} />
              ))}
            </ul>

            {/* Chrome, at every width. On a phone the header carries it, so it is the same control rather than a special case. */}
            <div
              data-nav-row=""
              className="border-sidebar-border mt-2 flex min-h-11 items-center border-t px-3 pt-4 md:min-h-8"
            >
              {footer}
            </div>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

/** The strip a phone scrolls, which is the whole of navigation under 768 now that the sheet is gone. */
export function TheNavOnAPhone() {
  return (
    <nav className="border-border bg-background/95 sticky top-16 z-10 border-b backdrop-blur-sm">
      <ul aria-label="Sections" className="flex gap-1 overflow-x-auto px-4 py-2">
        {DESTINATIONS.map((destination) => (
          <Where key={destination.to} destination={destination} across />
        ))}
      </ul>
    </nav>
  )
}

// 44px, which Apple's guidance and WCAG 2.5.5 arrive at separately, and the bar every control in this app is held to. It is here rather than only on the strip because the rail is tapped on a tablet at 768, which is above the breakpoint that hides the strip.

// A desk gets less: 32px rows are right under a mouse, and a list of 44px rows on a 1440px screen is a nav shouting.
const WHAT_A_THUMB_NEEDS = 'min-h-11 md:min-h-8'

function Where({ destination, across = false }: { destination: Destination; across?: boolean }) {
  const here = useRouterState({ select: (state) => state.location.pathname })
  // The same rule every shape of this nav has marked by: everything under `/more` is More, and only `/` itself is Sites.
  const on = destination.to === '/' ? here === '/' : here.startsWith(destination.to)

  return (
    <li className={across ? 'shrink-0' : undefined}>
      <Link
        to={destination.to}
        data-nav-row=""
        data-here={on || undefined}
        className={cn(
          WHAT_A_THUMB_NEEDS,
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          across
            ? 'text-muted-foreground data-[here]:bg-sidebar-primary data-[here]:text-sidebar-primary-foreground whitespace-nowrap'
            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[here]:bg-sidebar-primary data-[here]:text-sidebar-primary-foreground opacity-70 hover:opacity-100 data-[here]:opacity-100'
        )}
      >
        {across ? null : <destination.icon className="size-4 shrink-0" aria-hidden />}
        <span>{destination.label}</span>
      </Link>
    </li>
  )
}
