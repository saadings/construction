import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { OnShow } from './screens'
import { ON_SHOW } from './screens'

// Every screen in the app, drawn from invented figures, with nothing signed in. What was missing was never the sign-in -- the screens already take props, and the routes are what hold the readings. What was missing is a renderer that applies CSS and somewhere a person can look.

// The router was here for one reason -- several screens carry `<Link>`, and a link outside a router throws -- and now for a second: a screen's trail is read off the address it was matched at, so a gallery that drew everything at `/` would photograph every screen with no trail whatever it really shows. Each entry says where it lives and it is drawn there.
function whereItReallyLives(screen: OnShow) {
  const root = createRootRoute()
  const here = createRoute({ getParentRoute: () => root, path: screen.at, component: () => screen.draw() })

  // Somewhere for a link out of the screen to point, so following one is a navigation rather than an error.
  const anywhere = createRoute({ getParentRoute: () => root, path: '$', component: () => null })

  return createRouter({
    routeTree: root.addChildren([here, anywhere]),
    // Matched at the pattern and entered at a real address: `$siteId` is what the trail looks up, `s1` is what it fills back into a link.
    history: createMemoryHistory({ initialEntries: [screen.at.replaceAll(/\$\w+/g, 's1')] }),
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

// A camera is asked for in the address, `?camera`, and it takes the gallery's own furniture out of the layout.

// Hiding it was not enough and hiding it was the second wrong answer. The banner and the row of chips came to 287px of an 844px phone -- 34% of the picture was mine -- and at that height the day sheet's amount box sat at y=731, under a footer at 750. Anybody reading those images would have concluded the footer covers the amount, which it does not: without the furniture that box is at 444 and nowhere near it. A picture that looks like a phone and is not one is worse than no picture, and it is the same fault as the sticky footer coming out mid-form: well-formed, and an answer to a question nobody asked.
function askedForACamera(): boolean {
  return new URLSearchParams(window.location.search).has('camera')
}

export function Gallery() {
  const [slug, show] = useWhichScreen()
  const showing = ON_SHOW.find((screen) => screen.slug === slug) ?? ON_SHOW[0]
  const camera = askedForACamera()

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <Scaffolding camera={camera} />

      {/* Taken out of the layout for a photograph rather than made small in it: these are pure navigation and have no business in a picture of a screen at all. */}
      {camera ? null : (
        <>
          <Chips showing={showing} show={show} />
          <p className="text-faint px-4 py-2 text-[0.75rem] tracking-[0.06em] uppercase">{showing.where}</p>
        </>
      )}

      {/* Keyed, so moving from one screen to the next starts it fresh rather than carrying half a form over. Named, so a test can ask what the screen drew without the gallery's own chrome counting as part of it. */}
      <div data-testid="the-screen">
        <RouterProvider key={showing.slug} router={whereItReallyLives(showing)} />
      </div>
    </div>
  )
}

function Chips({ showing, show }: { showing: OnShow; show: (slug: string) => void }) {
  return (
    <div className="border-border flex flex-wrap gap-1.5 border-b px-4 py-3">
      {ON_SHOW.map((screen) => (
        <button
          key={screen.slug}
          type="button"
          onClick={() => {
            show(screen.slug)
          }}
          aria-current={screen.slug === showing.slug ? 'page' : undefined}
          // What the page knows about itself, written where anything opening it can read it. The script that photographs these screens has no list of its own and no marker of its own: it reads the buttons, and it waits for the words a screen shows before it takes the picture. A second list in a script is a list that drifts, and a screenshot taken on a timer is a picture of whatever had loaded.
          data-slug={screen.slug}
          data-proves={screen.proves}
          data-shown-in={screen.shownIn}
          data-tap-first={screen.tapFirst}
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
  )
}

// Said on the page, in words, and not only in a README. A demo full of plausible rows outlives the demo: the risk is not that anybody is fooled today, it is that in six weeks a screen here looks fine and nobody notices the real one stopped working.

// It survives into a photograph too, because a photograph is what gets forwarded and the words saying what it is have to travel with it. In front of the camera it stops taking a band off the top of the screen and becomes a strip lying over the very bottom of it: out of the flow, so the app's screen still starts at the top of the viewport and is the full height of one.
function Scaffolding({ camera }: { camera: boolean }) {
  if (camera) {
    return (
      <p
        role="note"
        // Translucent, so whatever it lies over is still legible underneath rather than replaced by it, and short enough that it is one line at 390.
        className="bg-brass/85 text-background pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 py-0.5 text-center text-[0.6875rem] tracking-[0.04em] backdrop-blur-sm"
      >
        Nothing here is the ledger — invented names, made-up figures
      </p>
    )
  }

  return (
    <p role="note" className="bg-brass/15 text-foreground border-brass/40 border-b px-4 py-2.5 text-sm">
      <span className="font-medium">Nothing here is the ledger.</span> Every name is invented and every figure is made
      up. This page draws the app’s screens from fixtures so they can be looked at without signing in — it is not
      connected to anything, and nothing typed into it is kept.
    </p>
  )
}
