import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '../ui/sidebar'
import { DESTINATIONS } from './destinations'

// The nav itself, taken out of `Shell` so something can look at it. It was the one part of this app no test and no picture had ever measured -- the shell holds Clerk's `UserButton`, Clerk will not render outside its own provider, and the gallery keeps the backend out on purpose, so the whole shell was exempt and the nav went with it.

// That is how every row in it stayed 32px tall on a phone. Nauman found it with a thumb, which is the only instrument that had been asked.

/** The way in, on a phone: the corner button that opens the sheet. It lives here rather than in `Shell` for one reason -- `Shell` cannot be drawn without a sign-in, and this is the only control that opens the only navigation a phone has. Kept beside the rows it opens so the two cannot drift, and so the gallery measures the button the app ships rather than a copy of it. */
export function TheWayIntoTheNav() {
  return <SidebarTrigger className="size-11" />
}

/** What Clerk draws goes here, because Clerk needs a provider and the gallery must not have one. `Shell` passes the real control; the gallery passes something the same size and says so on the page. */
export function TheNav({ footer }: { footer: ReactNode }) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-3 pt-3">
        <span className="font-display text-foreground text-xl leading-none">Construction</span>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        {/* Named, because shadcn's own markup is unlabelled `div`s and a list of links with no name is a list of links. It was `Sections` in all three hand-rolled shapes and it stays that, so nothing that could find it before has to learn a new word. */}

        {/* Further apart on a phone than on a desk, because the gap is part of the target: two 44px rows touching each other are still easy to miss between. */}
        <SidebarMenu aria-label="Sections" className="gap-2 md:gap-1">
          {DESTINATIONS.map((destination) => (
            <Where key={destination.to} destination={destination} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Chrome, at every width, which is the whole of #81's finding: a page cannot know what the chrome is doing, and the chrome cannot know what a page put in its corner. On a phone the sheet carries this, so it is the same answer rather than a special case -- and it is at the foot of the sheet where a thumb is, not above a list that has to be scrolled past. */}
      <SidebarFooter className="px-3 pb-4">
        {/* The row a thumb has to find, held open to the same height as the rows above it. Signing out is the one control nobody wants to reach for twice or hit by accident. */}
        <div className="flex min-h-11 items-center md:min-h-8">{footer}</div>
      </SidebarFooter>
    </Sidebar>
  )
}

// 44px, which Apple's guidance and WCAG 2.5.5 arrive at separately, and the same bar that made the date input a defect in #96. A phone gets it and a desk does not: 32px rows are right under a mouse, and a list of 44px rows on a 1440px screen is a nav shouting. One value cannot be right at both ends, so neither end gets a compromise.

// Written here rather than in `ui/sidebar.tsx`, which is generator output the next `shadcn add` overwrites. It lands through `cn`, so `h-11` replaces the variant's `h-8` and `md:h-8` puts it back above 768.
const WHAT_A_THUMB_NEEDS = 'h-11 gap-3 [&>svg]:size-5 md:h-8 md:gap-2 md:[&>svg]:size-4'

// A destination, and the sheet closes behind it. A sheet you have to dismiss after picking something is worse than the bar it replaced -- two actions where there was one, and the second is the one you forget while holding a cheque book.
function Where({ destination }: { destination: (typeof DESTINATIONS)[number] }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const here = useRouterState({ select: (state) => state.location.pathname })
  // The same rule the old nav marked by: everything under `/more` is More, and only `/` itself is Sites.
  const on = destination.to === '/' ? here === '/' : here.startsWith(destination.to)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={on} tooltip={destination.label} className={WHAT_A_THUMB_NEEDS}>
        <Link
          to={destination.to}
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
        >
          <destination.icon aria-hidden />
          <span>{destination.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
