import { UserButton } from '@clerk/tanstack-react-start'
import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '../ui/sidebar'
import { DESTINATIONS } from './destinations'

// One nav, shadcn's, in the two shapes it has: a column at the side from 768 up, and a sheet you open from the corner below that. The three hand-rolled shapes are gone, and with them the bar along the bottom of a phone.

// Nauman chose this knowing a thumb reaches the bottom of a phone and not the top. So the sheet is the whole of navigation there, and it is what he opens standing on a site -- which is where the care that used to go into the bar goes now.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="px-3 pt-3">
          <span className="font-display text-foreground text-xl leading-none">Construction</span>
        </SidebarHeader>

        <SidebarContent className="px-1.5 py-2">
          {/* Named, because shadcn's own markup is unlabelled `div`s and a list of links with no name is a list of links. It was `Sections` in all three hand-rolled shapes and it stays that, so nothing that could find it before has to learn a new word. */}
          <SidebarMenu aria-label="Sections">
            {DESTINATIONS.map((destination) => (
              <Where key={destination.to} destination={destination} />
            ))}
          </SidebarMenu>
        </SidebarContent>

        {/* Chrome, at every width, which is the whole of #81's finding: a page cannot know what the chrome is doing, and the chrome cannot know what a page put in its corner. On a phone the sheet carries this, so it is the same answer rather than a special case -- and it is at the foot of the sheet where a thumb is, not above a list that has to be scrolled past. */}
        <SidebarFooter className="px-3 pb-4">
          <UserButton />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* The only chrome over the content, and only where there is no column: the way into the sheet. It scrolls with nothing because it is sticky, which is the fault the sidebar had before this. */}
        <header className="bg-background/95 sticky top-0 z-20 flex items-center gap-2 px-3 py-2 backdrop-blur-sm md:hidden">
          <SidebarTrigger />
          <span className="font-display text-foreground text-lg leading-none">Construction</span>
        </header>

        {/* No width cap. A table of payments is the reason a desk is wider than a phone, and a column down the middle of a 1440px screen throws that away. */}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

// A destination, and the sheet closes behind it. A sheet you have to dismiss after picking something is worse than the bar it replaced -- two actions where there was one, and the second is the one you forget while holding a cheque book.
function Where({ destination }: { destination: (typeof DESTINATIONS)[number] }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const here = useRouterState({ select: (state) => state.location.pathname })
  // The same rule the old nav marked by: everything under `/more` is More, and only `/` itself is Sites.
  const on = destination.to === '/' ? here === '/' : here.startsWith(destination.to)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={on} tooltip={destination.label}>
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
