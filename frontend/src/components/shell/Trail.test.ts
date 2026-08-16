// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ABOVE, saidAs, theWayHere } from './Trail'

// Nauman asked for this from a phone, signed in, three levels deep on `Who can sign in`, with the nav behind a hamburger and nothing on the screen saying how he got there.

// The trail is derived from the address a screen was matched at, and the table it is derived through is the one thing here that can go stale: a route added without a line in it shows nothing and says nothing about why.
const ROUTE_TREE = readFileSync(
  join(dirname(new URL(import.meta.url).pathname), '..', '..', 'routeTree.gen.ts'),
  'utf8'
)

/** Every path the generated route tree declares, which is every screen that can need a trail. */
function everyRoute(): Array<string> {
  const declared = [...ROUTE_TREE.matchAll(/'(\/[^']*)': typeof \w+/g)].map((found) => found[1])

  // The generated tree declares `/more` and `/more/` for one screen. A trailing slash is the same address, and treating it as a second one would ask for a second line naming the same place.
  return declared.filter((path) => path === '/' || !path.endsWith('/'))
}

describe('the way back up', () => {
  it('has a line for every route this app has', () => {
    // The whole point of the guard: a route added without one draws no trail, and nothing else would say so.
    const unplaced = everyRoute().filter((path) => !ABOVE.has(path))

    expect(unplaced).toEqual([])
  })

  it('names nothing that is not a route any more', () => {
    // The other end. A line left behind for a deleted screen is a step that can never be reached and a name nobody maintains.
    const routes = new Set(everyRoute())

    expect([...ABOVE.keys()].filter((path) => !routes.has(path))).toEqual([])
  })

  it('is read against a route tree that really has routes', () => {
    // The floor. A pattern that stopped matching would report every route placed and every line used.
    expect(everyRoute().length).toBeGreaterThan(8)
    expect(everyRoute()).toContain('/more/who-can-sign-in')
  })

  it('climbs from a screen to the top, in the order somebody reads it', () => {
    expect(theWayHere('/more/who-can-sign-in')).toEqual(['/more', '/more/who-can-sign-in'])
    expect(theWayHere('/sites/$siteId/day')).toEqual(['/', '/sites/$siteId', '/sites/$siteId/day'])
    expect(theWayHere('/people/$personId')).toEqual(['/people', '/people/$personId'])
  })

  it('gives a top-level screen nothing above it, which is why those show no trail', () => {
    // An empty trail is the honest output. A `Home ›` over the houses would be inventing a level this app has not got.
    expect(theWayHere('/')).toEqual(['/'])
    expect(theWayHere('/owed')).toEqual(['/owed'])
    expect(theWayHere('/dashboard')).toEqual(['/dashboard'])
  })

  it('stops rather than circling, on an address it has never heard of', () => {
    // A route with no line reads as its own top. It draws no trail, which is wrong, and the guard above is what catches that -- but it must not hang while doing it.
    expect(theWayHere('/somewhere/nobody/added')).toEqual(['/somewhere/nobody/added'])
  })

  it('says the house rather than the id it is stored under', () => {
    // The one thing the router cannot supply. `sites/j57abc…` is not a step anybody can read.
    expect(saidAs('/sites/$siteId', { siteId: '1-A, Phase 0' })).toBe('1-A, Phase 0')
    expect(saidAs('/people/$personId', { personId: 'The tile shop' })).toBe('The tile shop')
  })

  it('falls back to what the step is called when nobody passed a name', () => {
    // A screen that forgets to pass one shows a readable word rather than a `$siteId`, and the gallery is where that is noticed.
    expect(saidAs('/sites/$siteId', {})).toBe('The house')
    expect(saidAs('/more/which-account', {})).toBe('Which account')
  })
})
