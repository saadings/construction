import { Link, useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { cn } from '../../lib/utils'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../ui/sheet'
import type { Destination } from './destinations'
import { DESTINATIONS, GROUPS } from './destinations'

// The rail: a dark column down the side of a desk, and the same thing inside a sheet on a phone. The design drew a horizontal strip instead of the sheet and he asked for the sheet back -- "I need sidebar on the mobile view as well like it was before" -- so this is drawn once and relocated rather than written twice.

// It does not decide where it is drawn. `Shell` does, and that is not only tidiness: a component carrying its own `md:hidden` cannot be photographed at the width it hides at, which is how the strip went unmeasured for an afternoon.

/** What Clerk draws goes here, because Clerk needs a provider and the gallery must not have one. `Shell` passes the real control; the gallery passes something the same size and says so on the page. */
export function TheNav({ footer, who }: { footer?: ReactNode; who?: ReactNode }) {
  const above = DESTINATIONS.filter((destination) => destination.under === undefined)

  return (
    // Every colour by name. The rail is dark against warm paper in the light theme and that separation has to survive the dark one, where the ground comes up to meet it -- so the surface and its edge are two tokens rather than one, and neither is decided here.
    <aside className="bg-sidebar text-sidebar-foreground sticky top-0 flex h-dvh w-60 shrink-0 flex-col">
      {/* Two lines, as drawn. The second was missing and it is what tells somebody what the thing is: `Construction` alone is a subject, `Construction Ledger` is a product. */}
      <div className="flex flex-col gap-0.5 px-5 pt-5 pb-4">
        <span className="font-display text-sidebar-foreground text-[22px] leading-none">Construction</span>
        <span className="text-sidebar-foreground/40 text-[11px] font-medium tracking-[0.14em] uppercase">Ledger</span>
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

            {/* At the foot of the rail and at the foot of the sheet, which is where he drew it: an avatar and the name beside it, above a hairline. It was in the corner of the phone header instead, on my argument that somebody reaching for a sign-out while alarmed looks for their own face rather than a menu -- he neither asked for that nor saw it, the drawing decides, and the cost is that signing out on a phone is two taps. */}

            {/* The drawing has no sign-out anywhere at all, so the avatar stays Clerk's own control rather than becoming the plain initials circle it draws. That one is on his list: identity you can see is not the same as a way out. */}
            {footer === undefined ? null : (
              <div
                data-nav-row=""
                className="border-sidebar-border mt-2 flex min-h-11 items-center gap-3 border-t px-3 pt-4 md:min-h-11"
              >
                {footer}
                {who === undefined ? null : (
                  <span className="text-sidebar-foreground min-w-0 truncate text-[13px] font-medium">{who}</span>
                )}
              </div>
            )}
          </li>
        </ul>
      </nav>
    </aside>
  )
}

/** The same rail, opened from the corner, which is the whole of navigation below 768. Its own component and not a branch inside `Shell` for the reason the rail's footer is a prop: `Shell` holds Clerk, Clerk will not render outside its provider, and a gallery entry drawing `Shell` draws nothing -- which is how this nav went unphotographed the first time. */
export function TheNavOnAPhone({ footer, who }: { footer?: ReactNode; who?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const here = useRouterState({ select: (state) => state.location.pathname })

  // Closed behind whatever was picked. A sheet you have to dismiss afterwards is two actions where there was one, and the second is the one you forget while holding a cheque book.
  useEffect(() => {
    setOpen(false)
  }, [here])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* 44px in both directions, and it is the one control that reaches all of navigation on a phone: a 36px hamburger makes the whole nav 36px however tall its rows are. */}
      <SheetTrigger
        data-nav-row=""
        aria-label="Sections"
        className="text-foreground hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-md"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>

      <SheetContent side="left" className="bg-sidebar w-60 border-0 p-0">
        {/* Named for a screen reader and hidden from the page: the rail draws the wordmark itself, and a sheet with two titles reads as two things. */}
        <SheetTitle className="sr-only">Sections</SheetTitle>
        <TheNav footer={footer} who={who} />
      </SheetContent>
    </Sheet>
  )
}

// 44px, which Apple's guidance and WCAG 2.5.5 arrive at separately, and the bar every control in this app is held to.

// Asked of the pointer rather than of the width, and that is the correction. A width was standing in for a device -- fine while the sheet meant a phone was the only touch device that reached the nav, and false the moment the rail became the only navigation above 768. An iPad in portrait is 768 to 834 CSS px and is a thumb; it was getting 36px rows, which is the defect he reported at 32.

// Coarse is the default and a fine pointer opts down, so a browser that does not understand the variant gives everybody the reachable height rather than the tight one. A desk still gets less: 36px rows are right under a mouse, and a list of 44px rows on a 1440px screen is a nav shouting.
const WHAT_A_THUMB_NEEDS = 'min-h-11 pointer-fine:min-h-9'

function Where({ destination }: { destination: Destination }) {
  const here = useRouterState({ select: (state) => state.location.pathname })
  // The same rule every shape of this nav has marked by: everything under `/more` is More, and only `/` itself is Sites.
  const on = destination.to === '/' ? here === '/' : here.startsWith(destination.to)

  return (
    <li>
      <Link
        to={destination.to}
        data-nav-row=""
        data-here={on || undefined}
        className={cn(
          WHAT_A_THUMB_NEEDS,
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground opacity-70 hover:opacity-100',
          'data-[here]:bg-sidebar-primary data-[here]:text-sidebar-primary-foreground data-[here]:opacity-100'
        )}
      >
        <destination.icon className="size-4 shrink-0" aria-hidden />
        <span>{destination.label}</span>
      </Link>
    </li>
  )
}
