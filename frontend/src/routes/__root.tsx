import { ClerkProvider, Show, SignInButton, UserButton, useAuth, useUser } from '@clerk/tanstack-react-start'
import { dark } from '@clerk/themes'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useMutation, useQuery } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { howManyAreWaiting, whatIsStillWaiting } from '../components/daySheet/theSittingKept'
import { TheSearch } from '../components/search/TheSearch'
import { Shell } from '../components/shell/Shell'
import type { Counts } from '../components/shell/TheNav'
import { WayIn } from '../components/shell/WayIn'
import { env } from '../lib/env'
import { THEME_INIT_SCRIPT, applyHowItLooks, useHowItLooks, usePrefersDark } from '../lib/theme'
import type { RouterContext } from '../router'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: env.VITE_APP_TITLE || 'Construction',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { convexClient } = Route.useRouteContext()
  const { chosen, dark: isDark } = useHowItLooks()
  const prefersDark = usePrefersDark()

  // Keeps `<html>` in step with a device that changes while the app is open; the head script only gets the first frame.
  useEffect(() => {
    applyHowItLooks(chosen, prefersDark)
  }, [chosen, prefersDark])

  return (
    // Clerk's screens are not styled from these tokens, so they are told which way round the app is; pinned to dark they arrive as a dark panel over a light page.
    <ClerkProvider appearance={{ baseTheme: isDark ? dark : undefined }}>
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        {/* Signed out there is one screen, whatever was asked for. Rendering the outlet here put every other route in front of somebody with no session: a form nobody can send, over a reading that never comes back. */}
        <Show when="signed-out">
          <WayIn opens={TheSignIn} />
        </Show>
        <Show when="signed-in">
          <RememberThisSignIn />
          <TheApp />
        </Show>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

// Clerk's own, and the only part of the way in that the gallery cannot draw. Declared here rather than written inline in the tree above, because a component type made fresh on every render is a different component every time and remounts everything under it.
function TheSignIn({ children }: { children: ReactNode }) {
  return <SignInButton mode="modal">{children}</SignInButton>
}

// Every read refuses a sign-in the ledger has never seen, and a query cannot write itself in. This is the one call that can, made once when somebody signs in.

// It exists because the Clerk webhook only ever fires for a new Clerk user: anybody whose account predates this table would otherwise be refused forever, with nothing on any screen able to say why.
function RememberThisSignIn() {
  const remember = useMutation(api.accounts.mutations.rememberThisSignIn)

  useEffect(() => {
    void remember({})
  }, [remember])

  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans wrap-anywhere antialiased">
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

// The shell with everything it cannot fetch for itself handed in.

// A component of its own and not the tree above, because the reading below it needs Convex's provider -- and the provider is inside `RootComponent`'s own returned JSX, so a hook called in that component's body runs outside it. It does: the prerender fell over on exactly that, with `Prerendered 0 pages` and then a missing `_shell.html`, which is the symptom rather than the finding.

// The rule is written here rather than only in `Shell`, because this is the file where it comes apart. `Shell` says a shell must not own a provider-bound thing, and that is true and it is not the whole of it -- **nothing may read a provider from outside it**, and this is the one component in the app that renders the providers rather than sitting inside them. A rule written where it was learned does not travel to where it applies next.
function TheApp() {
  // Both of these are handed in rather than drawn inside the shell, for the reason the shell says: one reads the ledger and the other is Clerk's, and neither will render without the provider it belongs to. A shell that owns either cannot be drawn by anything -- which was every test about the nav, and every camera.

  // Clerk's real control and not a wrapper around one. `WayIn` was made drawable the same way and that is the caution as well as the precedent: a prop the app fills is a prop the app can fill with something that does nothing, and the screen photographs perfectly either way. `chrome.test` is what asks whether what is handed over here is the real thing.
  return (
    <Shell
      finding={<TheSearch />}
      account={(avatar) => <UserButton appearance={{ elements: { userButtonAvatarBox: avatar } }} />}
      who={<TheirName />}
      counts={useWhatIsWaiting()}
    >
      <Outlet />
    </Shell>
  )
}

// What a rail row has waiting behind it. `Payables` is his own badge and carries how many people are owed something.

// Read here rather than in the shell, for the reason everything else handed to it is: this needs Clerk's provider and Convex's, and a shell that needs either is a shell nothing can draw or photograph.

// It is one subscription on every screen rather than only on `Payables`, which is the cost of a badge that has to be right wherever you are standing. Convex dedupes it with the same read on `Payables` itself, and it is live -- so the number moves the moment a bill or a payment does, which is the whole reason it is worth carrying.
function useWhatIsWaiting(): Counts {
  const owed = useQuery(api.owed.queries.position, {})
  const here = useRouterState({ select: (state) => state.location.pathname })

  // Read again on every move, and deliberately not while somebody is typing.

  // A same-tab write to `localStorage` raises no event, so this cannot follow a keystroke without being told -- and telling it would redraw the whole shell on every keystroke of a twenty-payment sitting.

  // Which is the right way round rather than a concession. On the daybook the number is beside the work and the badge has no job; it acquires one the moment he walks away, and walking away is navigation. Stale while looking at the truth is not staleness.
  const [waiting, setWaiting] = useState(() => howManyAreWaiting(whatIsStillWaiting()))

  useEffect(() => {
    setWaiting(howManyAreWaiting(whatIsStillWaiting()))
  }, [here])

  // Nothing at all until it answers, and nothing when it is refused. A badge is a claim that something needs you, and a reading that has not come back is not a claim about anything.
  return {
    '/owed': owed?.everyone.filter((person) => person.outstandingPaisa > 0).length,
    '/daybook': waiting,
  }
}

// The name beside the avatar at the foot of the nav, as drawn. Read here rather than in the shell for the reason everything else in that file is a prop: `useUser` needs Clerk's provider, and a shell that needs one is a shell nothing can draw or photograph.

// Nothing at all until Clerk has answered, rather than a placeholder: a name is the one thing on that row, and a wrong or stand-in name beside somebody's own avatar is worse than a row with an avatar alone.
function TheirName() {
  const { user } = useUser()

  return user?.fullName ?? null
}
