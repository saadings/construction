import { UserButton } from '@clerk/tanstack-react-start'
import type { ReactNode } from 'react'

import { TheNav, TheNavOnAPhone } from './TheNav'

// The shell he drew: a dark rail down the side of a desk, a header that stays, and a strip a phone scrolls sideways where the rail cannot fit.

// It was shadcn's `Sidebar` -- a column above 768 and a sheet behind a hamburger below it. The design has no hamburger and no sheet, which is his decision to make; what it also had was a 34px strip, and that is the defect he reported when the rows were 32px. So the arrangement is his and the height is the app's.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-dvh w-full">
      {/* Clerk's own button, sized through the only handle it gives: a class on the avatar box. Reasoned rather than measured -- nothing draws this without a sign-in, so the wrapper around it is what the sweep can see and this is what it cannot. */}
      <div className="hidden md:flex">
        <TheNav footer={<UserButton appearance={{ elements: { userButtonAvatarBox: 'size-8' } }} />} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The one bar over the content at every width. It is where the trail is on a desk and where the way out of a screen is on a phone, and it scrolls with nothing because it is sticky. */}
        <header className="border-border bg-background/90 sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b px-6 backdrop-blur-sm">
          <span className="font-display text-foreground text-lg leading-none md:hidden">Construction</span>
        </header>

        <div className="md:hidden">
          <TheNavOnAPhone />
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
