import { ClerkProvider, Show, useAuth } from '@clerk/tanstack-react-start'
import { dark } from '@clerk/themes'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useEffect } from 'react'

import { Shell } from '../components/shell/Shell'
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
        {/* The nav belongs to somebody who is signed in. Signed out, there is one screen and nowhere else to go. */}
        <Show when="signed-out">
          <Outlet />
        </Show>
        <Show when="signed-in">
          <Shell>
            <Outlet />
          </Shell>
        </Show>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
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
