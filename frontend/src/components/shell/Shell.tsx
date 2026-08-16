import { UserButton } from '@clerk/tanstack-react-start'
import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider } from '../ui/sidebar'
import { TheNav, TheWayIntoTheNav } from './TheNav'

// One nav, shadcn's, in the two shapes it has: a column at the side from 768 up, and a sheet you open from the corner below that. The three hand-rolled shapes are gone, and with them the bar along the bottom of a phone.

// Nauman chose this knowing a thumb reaches the bottom of a phone and not the top. So the sheet is the whole of navigation there, and it is what he opens standing on a site -- which is where the care that used to go into the bar goes now.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      {/* The nav is its own file so the gallery can draw it: everything here is exempt from being looked at, because Clerk will not render outside its own provider and the gallery holds nothing that could reach a deployment. */}

      {/* Clerk's own button, sized through the only handle it gives: a class on the avatar box. Reasoned rather than measured -- nothing draws this without a sign-in, so the wrapper around it is what the sweep can see and this is what it cannot. */}
      <TheNav footer={<UserButton appearance={{ elements: { userButtonAvatarBox: 'size-11 md:size-8' } }} />} />

      <SidebarInset>
        {/* The only chrome over the content, and only where there is no column: the way into the sheet. It scrolls with nothing because it is sticky, which is the fault the sidebar had before this. */}
        <header className="bg-background/95 sticky top-0 z-20 flex items-center gap-2 px-3 py-2 backdrop-blur-sm md:hidden">
          {/* 28px as it comes, on the one control that opens the only navigation a phone has. Sized beside the rows it opens, in the file the gallery can draw, so the same sweep measures both. */}
          <TheWayIntoTheNav />
          <span className="font-display text-foreground text-lg leading-none">Construction</span>
        </header>

        {/* No width cap. A table of payments is the reason a desk is wider than a phone, and a column down the middle of a 1440px screen throws that away. */}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
