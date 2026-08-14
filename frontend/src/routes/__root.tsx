import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { dark } from '@clerk/themes'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useEffect } from 'react'

import { env } from '../lib/env'
import { THEME_INIT_SCRIPT, applyColourScheme, usePrefersDark } from '../lib/theme'
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
  const prefersDark = usePrefersDark()

  // Keeps `<html>` in step with a device that changes while the app is open; the head script only gets the first frame.
  useEffect(() => {
    applyColourScheme(prefersDark)
  }, [prefersDark])

  return (
    // Clerk's screens follow the device too; pinned to dark they arrive as a dark panel over a light page.
    <ClerkProvider appearance={{ baseTheme: prefersDark ? dark : undefined }}>
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <Outlet />
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
