// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Signed out there is one screen. The root rendered the outlet instead, so every route but the home one was put in front of somebody with no session: a form nobody can send, over a reading that never comes back and never says why.

const ROUTES = dirname(new URL(import.meta.url).pathname)

/** What the root puts on screen for somebody signed out, or null when it has no such branch at all. */
export function whatIsShownSignedOut(source: string): string | null {
  // Absence answered separately: a root with no signed-out branch would otherwise read as one rendering nothing, which is the safe answer to the wrong question.
  const branch = /<Show\s+when="signed-out"\s*>([\s\S]*?)<\/Show>/.exec(source)
  if (branch === null) return null

  return branch[1].trim()
}

const root = readFileSync(join(ROUTES, '__root.tsx'), 'utf8')

describe('what somebody signed out is shown', () => {
  it('is one screen, whatever they asked for', () => {
    const shown = whatIsShownSignedOut(root)

    expect(shown).not.toBeNull()
    // The outlet is whatever route the address named. Anything else is a single screen, which is the point.
    expect(shown).not.toContain('<Outlet')
    expect(shown).toContain('<WayIn')
  })

  it('would notice the outlet coming back, and a branch going away', () => {
    // Both controls. The first is the defect verbatim; the second is what a root that stopped gating at all would look like.
    expect(whatIsShownSignedOut('<Show when="signed-out">\n  <Outlet />\n</Show>')).toBe('<Outlet />')
    expect(whatIsShownSignedOut('<ClerkProvider>{children}</ClerkProvider>')).toBeNull()
  })

  it('leaves no route deciding this for itself', () => {
    // One place decides, so a new screen cannot be written without it and cannot contradict it. A route that gates itself is a second answer to a question already answered.
    const deciding = readdirSync(ROUTES)
      .filter((name) => /\.tsx$/.test(name) && name !== '__root.tsx' && !/\.test\./.test(name))
      .filter((name) => /when="signed-(in|out)"/.test(readFileSync(join(ROUTES, name), 'utf8')))

    expect(deciding).toEqual([])
  })

  it('is reading the routes, so an empty answer above would have been a failure', () => {
    // The floor. A directory this cannot read returns nothing to check and passes exactly as a clean one does.
    const routes = readdirSync(ROUTES).filter((name) => /\.tsx$/.test(name) && !/\.test\./.test(name))

    expect(routes.length).toBeGreaterThan(5)
    expect(routes).toContain('people.tsx')
  })
})
