import { Link, useRouter, useRouterState } from '@tanstack/react-router'

import { ROOM_FOR_A_LINK } from '../roomForAThumb'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb'

// Where you are, and the way back up. Nauman asked for it from a phone, signed in, three levels deep on `Who can sign in`, with the nav behind a hamburger and nothing on the screen saying how he got there or how to leave except the browser's own back button.

// Written once and rendered by `Page`, for the same reason the padding is: a screen that has to remember to draw its own trail is a screen that forgets.

/** What is above each screen, and what it is called. Kept here rather than derived, because the route tree is not the hierarchy: `/` is the houses, and `/sites/$siteId` sits under it although no `/sites` route exists. A guard beside this holds every route in the generated tree to having a line here. */
export const ABOVE = new Map<string, { name: string; under?: string }>(
  Object.entries({
    '/': { name: 'Sites' },
    '/dashboard': { name: 'Dashboard' },
    '/owed': { name: 'Payables' },
    '/money-in': { name: 'Receipts' },
    '/reports': { name: 'Reports' },
    '/people': { name: 'People' },
    '/people/$personId': { name: 'Their account', under: '/people' },
    '/more': { name: 'Settings' },
    '/more/what-for': { name: 'Trade', under: '/more' },
    '/more/which-account': { name: 'Account', under: '/more' },
    '/more/who-can-sign-in': { name: 'Who can sign in', under: '/more' },
    '/more/how-it-looks': { name: 'Appearance', under: '/more' },
    '/sites/new': { name: 'Start a house', under: '/' },
    '/sites/$siteId': { name: 'The house', under: '/' },
    '/sites/$siteId/day': { name: 'Expenses', under: '/sites/$siteId' },
    '/sites/$siteId/coming-in': { name: 'Invested', under: '/sites/$siteId' },
    '/sites/$siteId/shares': { name: 'Partner shares', under: '/sites/$siteId' },
  })
)

/** What a `$param` in a path is really called, handed in by the screen that knows: a trail reading `1-A, Phase 0` says what `sites/j57abc…` cannot. */
export type Named = { siteId?: string; personId?: string }

/** Every step above this one, nearest last, with the screen itself at the end. */
export function theWayHere(pattern: string): Array<string> {
  const steps: Array<string> = []

  for (let at: string | undefined = pattern; at !== undefined; at = ABOVE.get(at)?.under) {
    steps.unshift(at)

    // A route nobody gave a line reads as its own top: it draws no trail, which is wrong, and the guard beside this is what says so. It must not circle while being wrong.
    if (!ABOVE.has(at)) break
  }

  return steps
}

/** A step said the way somebody would say it, with a `$param` swapped for what it stands for. */
export function saidAs(pattern: string, named: Named): string {
  if (pattern === '/sites/$siteId' && named.siteId !== undefined) return named.siteId
  if (pattern === '/people/$personId' && named.personId !== undefined) return named.personId

  return ABOVE.get(pattern)?.name ?? pattern
}

/** The address a step points at, with its `$param` filled back in from where we are now. */
function reachedBy(pattern: string, params: Record<string, string>): string {
  return pattern.replaceAll(/\$(\w+)/g, (whole, name: string) => params[name] ?? whole)
}

// Asked before anything is read, because `useRouterState` throws outside a router rather than answering. Component tests render a screen on its own, where there is no navigation to describe and nothing to link to -- what proves this draws is the gallery, which has a router, photographed and measured at three widths.
export function Trail({ named = {} }: { named?: Named }) {
  // Read as `unknown` on purpose. The signature says a router always comes back; the runtime returns the context's own empty value when there is none, and believing the type is how this throws on every screen a component test renders.

  // `null` and not `undefined`, measured rather than assumed: the failure without this check was `Cannot read properties of null`. If that ever changes it fails loudly here rather than drawing nothing quietly, which is the right way round.
  const router: unknown = useRouter({ warn: false })

  return router === null ? null : <TheWayBack named={named} />
}

function TheWayBack({ named }: { named: Named }) {
  const { pattern, params } = useRouterState({
    select: (state) => {
      const deepest: { routeId?: string; params?: Record<string, string> } | undefined = state.matches.at(-1)

      return { pattern: deepest?.routeId ?? '/', params: deepest?.params ?? {} }
    },
  })

  const steps = theWayHere(pattern)

  // Nothing above it, so nothing to say. A `Sites ›` over the houses screen would be inventing a level this app has not got.
  if (steps.length < 2) {
    return null
  }

  const above = steps.slice(0, -1)

  return (
    <Breadcrumb>
      {/* Wraps rather than scrolls, and the separators go with the words they follow, so a trail that runs past a phone's width breaks between steps instead of inside one. */}
      <BreadcrumbList className="flex-wrap">
        {above.map((step) => (
          <BreadcrumbItem key={step}>
            {/* A step is the way back up and it was 20px high, which is under WCAG 2.5.8's floor for a link sitting in a line. `ROOM_FOR_A_LINK` is four pixels of padding given straight back to the layout, so the trail is as tall as it was and the step is as tall as a fingertip. */}
            <BreadcrumbLink asChild className={ROOM_FOR_A_LINK}>
              <Link to={reachedBy(step, params)}>{saidAs(step, named)}</Link>
            </BreadcrumbLink>
            <BreadcrumbSeparator />
          </BreadcrumbItem>
        ))}

        {/* Where you are, said and not linked: a link to the screen you are on is a link that does nothing. */}
        <BreadcrumbItem>
          <BreadcrumbPage>{saidAs(pattern, named)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
