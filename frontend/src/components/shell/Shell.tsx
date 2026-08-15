import { UserButton } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { DESTINATIONS, ON_THE_PHONE } from './destinations'

// One nav in three shapes, chosen by the width of the screen and nothing else: no measuring, no state, so it is the same before and after the page comes alive.

// A sidebar down the side at a desk, a bar across the top on a tablet, and a bar along the bottom on a phone, where a thumb reaches the bottom and not the top.

// Chrome lives here and nowhere else. The sign-in was fixed to the top right corner of one route, which put it over that page's own header at every width where the header has anything in it -- Nauman opened the app on a desk and it was sitting on the button. A page cannot know what the chrome is doing and the chrome cannot know what a page has put in its corner, so the only arrangement that holds is the one where they never share a corner.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-dvh lg:flex">
      <SideBar />
      <TopBar />

      {/* No width cap here. A table of payments is the reason a desk is wider than a phone, and a column down the middle of a 1440px screen throws that away. */}
      <main className="flex-1 pb-[var(--phone-bar)] sm:pb-0">{children}</main>

      <PhoneBar />
    </div>
  )
}

function SideBar() {
  return (
    <nav
      aria-label="Sections"
      // Sticky and its own height, and `self-start` with them: a flex child stretches to the row by default, so a nav as tall as the page has nowhere to stick to and scrolls away with the content. Nauman asked why it scrolls, which is the third thing he has found by looking at it.
      className="bg-panel border-border hidden w-[186px] shrink-0 flex-col gap-1 border-r px-3 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start"
    >
      <TheName className="px-2 pb-4" />
      {DESTINATIONS.map((destination) => (
        <Link
          key={destination.to}
          to={destination.to}
          activeOptions={{ exact: destination.to === '/' }}
          className="text-muted-foreground hover:bg-hairline hover:text-foreground data-[status=active]:bg-hairline data-[status=active]:text-foreground flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors data-[status=active]:font-medium"
        >
          <destination.icon className="size-4" aria-hidden />
          {destination.label}
        </Link>
      ))}

      {/* At the foot of the column rather than the top of the page: it is the thing reached least often here, and nothing else is down there to be sat on. */}
      <div className="mt-auto px-2 pt-4">
        <UserButton />
      </div>
    </nav>
  )
}

// Between a phone and a desk: the sidebar would eat a third of the width, and the bottom bar is out of reach of a hand holding a tablet.
function TopBar() {
  return (
    <nav
      aria-label="Sections"
      // The same fault one shape over: a bar across the top that scrolls away is a bar you have to go back up for. It is not in the flex row the sidebar is in, so it needs no `self-start`.
      className="bg-panel border-border sticky top-0 z-20 hidden items-center gap-1 border-b px-4 py-3 sm:flex lg:hidden"
    >
      <TheName className="pr-4" />
      {DESTINATIONS.map((destination) => (
        <Link
          key={destination.to}
          to={destination.to}
          activeOptions={{ exact: destination.to === '/' }}
          className="text-muted-foreground hover:bg-hairline hover:text-foreground data-[status=active]:bg-hairline data-[status=active]:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors data-[status=active]:font-medium"
        >
          {destination.label}
        </Link>
      ))}

      {/* Pushed to the end of the bar, which is the corner a page's own header also uses -- but this is the chrome's row and no page draws in it. */}
      <div className="ml-auto flex items-center">
        <UserButton />
      </div>
    </nav>
  )
}

function PhoneBar() {
  return (
    <nav
      aria-label="Sections"
      className="bg-panel border-border fixed inset-x-0 bottom-0 z-20 grid border-t pb-[env(safe-area-inset-bottom)] sm:hidden"
      style={{ gridTemplateColumns: `repeat(${ON_THE_PHONE.length}, minmax(0, 1fr))` }}
    >
      {ON_THE_PHONE.map((destination) => (
        <Link
          key={destination.to}
          to={destination.to}
          activeOptions={{ exact: destination.to === '/' }}
          className="text-muted-foreground data-[status=active]:text-brass flex flex-col items-center gap-1 py-2.5 text-[0.6875rem]"
        >
          <destination.icon className="size-5" aria-hidden />
          {destination.label}
        </Link>
      ))}
    </nav>
  )
}

function TheName({ className }: { className?: string }) {
  return <span className={cn('font-display text-foreground text-xl leading-none', className)}>Construction</span>
}
