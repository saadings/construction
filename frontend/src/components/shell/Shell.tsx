import { UserButton } from '@clerk/tanstack-react-start'
import type { ReactNode } from 'react'

import { TheNav, TheNavOnAPhone } from './TheNav'

// The shell he drew, with the one thing he asked back: "I need sidebar on the mobile view as well like it was before."

// So below 768 the rail is a sheet opened from the corner, and above it the rail is simply there. It is the same component in both -- relocated rather than reimplemented -- because two navigations for one list is how a destination comes to exist in one and not the other.

// The design's horizontal strip is gone with it. Two navigations for five destinations is duplication, and a scroller hides its tail: `Daybook`, `Receipts`, `Reports` and `Partners` are four rows nobody would know were there.

// The search is handed in rather than drawn here, and it is the same rule the nav's footer is written to: `TheSearch` reads the ledger, `useQuery` throws outside a Convex client, and a `Shell` that owns one is a `Shell` nothing can render on its own. Nine tests about the nav failed the moment it was put in this file directly -- not wrongly, and not about the nav.

// Which is the rule twice over now: a component bound to a provider must not own anything else worth drawing. Clerk taught it first, and the nav spent an afternoon unphotographed inside a component nothing could draw.
export function Shell({ children, finding }: { children: ReactNode; finding?: ReactNode }) {
  // Clerk's own button, sized through the only handle it gives: a class on the avatar box. Reasoned rather than measured -- nothing draws this without a sign-in, so the wrapper around it is what the sweep can see and this is what it cannot.
  const signOut = <UserButton appearance={{ elements: { userButtonAvatarBox: 'size-8' } }} />

  return (
    <div className="bg-background text-foreground flex min-h-dvh w-full">
      <div className="hidden md:flex">
        <TheNav footer={signOut} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The one bar over the content at every width, and on a phone it is the whole way into the nav. It scrolls with nothing because it is sticky, which is the fault the sidebar had before this. */}
        <header className="border-border bg-background/90 sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm md:px-6">
          <div className="md:hidden">
            <TheNavOnAPhone />
          </div>

          <span className="font-display text-foreground text-lg leading-none md:hidden">Construction</span>

          {/* Nauman asked for it and this is where it goes: on every screen, because looking for a house is not a thing you first navigate somewhere to do. On a desk it is a field with its own words in it; on a phone it is a square beside the nav, because the row already holds three things. */}
          <div className="ml-auto md:ml-0">{finding}</div>

          {/* The corner, on a phone, on every screen. Signing out is not a thing somebody strolls to -- it is what they reach for on a shared phone or the wrong account, and they look for their own face rather than for a menu. It is out of the sheet entirely: two places to sign out is worse than either one. */}
          <div className="ml-auto flex size-11 items-center justify-center md:hidden">
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'size-11' } }} />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
