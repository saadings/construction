import { ClerkProvider, Show, SignInButton, useAuth } from '@clerk/tanstack-react-start'
import { dark } from '@clerk/themes'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useMutation } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { api } from '../../../convex/_generated/api'
import { Shell } from '../components/shell/Shell'
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
          <Shell>
            <Outlet />
          </Shell>
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
