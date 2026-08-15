import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ON_SHOW } from './screens'

// Every screen in the app, drawn from invented figures, with nothing signed in. What was missing was never the sign-in -- the screens already take props, and the routes are what hold the readings. What was missing is a renderer that applies CSS and somewhere a person can look.

// The router is here for one reason: several screens carry `<Link>`, and a link outside a router throws. It is the same harness the component tests already use -- a root and a catch-all -- and nothing about routing is being shown.
function withSomewhereForLinksToPoint(drawing: () => React.ReactNode) {
  const root = createRootRoute()
  const anywhere = createRoute({ getParentRoute: () => root, path: '$', component: () => drawing() })
  const here = createRoute({ getParentRoute: () => root, path: '/', component: () => drawing() })

  return createRouter({
    routeTree: root.addChildren([here, anywhere]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
}

/** Which screen is being shown, kept in the address after the `#` so a screenshot can ask for one by name. */
function useWhichScreen(): [string, (slug: string) => void] {
  const [slug, setSlug] = useState(() => window.location.hash.slice(1) || ON_SHOW[0].slug)

  useEffect(() => {
    const followTheAddress = () => {
      setSlug(window.location.hash.slice(1) || ON_SHOW[0].slug)
    }

    window.addEventListener('hashchange', followTheAddress)

    return () => {
      window.removeEventListener('hashchange', followTheAddress)
    }
  }, [])

  return [
    slug,
    (chosen: string) => {
      window.location.hash = chosen
    },
  ]
}

export function Gallery() {
  const [slug, show] = useWhichScreen()
  const showing = ON_SHOW.find((screen) => screen.slug === slug) ?? ON_SHOW[0]

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <Scaffolding />

      <div className="border-border flex flex-wrap gap-1.5 border-b px-4 py-3">
        {ON_SHOW.map((screen) => (
          <button
            key={screen.slug}
            type="button"
            onClick={() => {
              show(screen.slug)
            }}
            aria-current={screen.slug === showing.slug ? 'page' : undefined}
            className={
              screen.slug === showing.slug
                ? 'border-primary bg-accent text-accent-foreground rounded-md border px-2.5 py-1.5 text-sm font-medium'
                : 'border-border text-muted-foreground rounded-md border px-2.5 py-1.5 text-sm'
            }
          >
            {screen.name}
          </button>
        ))}
      </div>

      <p className="text-faint px-4 py-2 text-[0.75rem] tracking-[0.06em] uppercase">{showing.where}</p>

      {/* Keyed, so moving from one screen to the next starts it fresh rather than carrying half a form over. Named, so a test can ask what the screen drew without the gallery's own chrome counting as part of it. */}
      <div data-testid="the-screen">
        <RouterProvider key={showing.slug} router={withSomewhereForLinksToPoint(showing.draw)} />
      </div>
    </div>
  )
}

// Said on the page, in words, and not only in a README. A demo full of plausible rows outlives the demo: the risk is not that anybody is fooled today, it is that in six weeks a screen here looks fine and nobody notices the real one stopped working.
function Scaffolding() {
  return (
    <p role="note" className="bg-brass/15 text-foreground border-brass/40 border-b px-4 py-2.5 text-sm">
      <span className="font-medium">Nothing here is the ledger.</span> Every name is invented and every figure is made
      up. This page draws the app’s screens from fixtures so they can be looked at without signing in — it is not
      connected to anything, and nothing typed into it is kept.
    </p>
  )
}
