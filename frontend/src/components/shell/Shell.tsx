import type { ReactNode } from 'react'

import { TheNav, TheNavOnAPhone } from './TheNav'
import { TheStrip } from './TheStrip'

// The shell he drew. He opened the deployed app and said it is very different from what he drew, and he was right: every instrument we built asks whether this app is readable, reachable and consistent with itself, and not one of them asks whether it is the thing on the drawing.

// So the drawing decides, and a difference is something brought to him rather than something made. Three of the differences in this file were mine.

// The one exception is his own: "I need sidebar on the mobile view as well like it was before." The hamburger and the sheet stay. **The strip is back beside them** -- it is in the design, I read *as well* as *instead*, and dropped it on my own reasoning.

// The app's name is out of the header. The breadcrumb's first step is `Ledger` and carries the identity; two names in one bar is the duplication the drawing avoids.

// The account is out of the corner and back at the foot of the nav, where he drew it. That placement was mine, argued from somebody reaching for a sign-out while alarmed, and the cost of putting it back is that signing out on a phone is two taps.

// What is handed in rather than drawn here, and why it is a rule rather than a habit: `TheSearch` reads the ledger and Clerk's control needs its own provider, so a `Shell` owning either is a `Shell` nothing can render. That is how the nav's rows stayed 32px until a thumb found them, and how this header went unphotographed at every width until the account became a prop.
export function Shell({
  children,
  finding,
  account,
  who,
}: {
  children: ReactNode
  finding?: ReactNode
  /** Whoever is signed in, drawn at whatever size the place asks for. */
  account: (avatar: string) => ReactNode
  /** Their name, beside the avatar at the foot of the nav, as drawn. */
  who?: ReactNode
}) {
  return (
    <div className="bg-background text-foreground flex min-h-dvh w-full">
      <div className="hidden md:flex">
        <TheNav footer={account('size-8')} who={who} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The one bar over the content at every width. It scrolls with nothing because it is sticky, which is the fault the sidebar had before this. */}
        <header className="border-border bg-background/90 sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm md:px-6">
          {/* His, and the one thing in this bar the drawing does not have. Below 768 the strip underneath is the whole of navigation in the design; he asked for the sidebar as well, so this opens it. */}
          <div className="md:hidden">
            <TheNavOnAPhone footer={account('size-8')} who={who} />
          </div>

          {/* The drawing puts the breadcrumb here, `Ledger ›` and then the screen. It is not here, and that is on the list rather than done: `columns` refuses a trail inside a sticky header -- *navigation scrolls off, identity stays* -- so taking the drawing literally fails a guard this app already holds. `Page` still draws the trail in the content. */}
          <div className="min-w-0 flex-1" />

          <div className="flex items-center gap-3">{finding}</div>
        </header>

        {/* Under the header and above everything, sticky at the header's own height, as drawn. */}
        <TheStrip />

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
