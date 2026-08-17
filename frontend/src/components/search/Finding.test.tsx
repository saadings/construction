// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DESTINATIONS } from '../shell/destinations'
import type { Findable } from './Finding'
import { Finding, WayToFind, whatCanBeFound } from './Finding'

afterEach(cleanup)

const FOUND: Array<Findable> = [
  { id: 's1', name: '1-A, Phase 0', what: 'House', to: '/sites/s1' },
  { id: 'p1', name: 'The tile shop', what: 'Person', to: '/people/p1' },
]

function drawIt(found: Array<Findable> | undefined) {
  const root = createRootRoute({ component: () => <Finding found={found} open onOpen={() => undefined} /> })
  const kids = DESTINATIONS.map((destination) => destination.to).concat(['/sites/$siteId', '/people/$personId'])

  const router = createRouter({
    routeTree: root.addChildren(
      kids.map((path) => createRoute({ getParentRoute: () => root, path, component: () => null }))
    ),
    history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
  })

  render(<RouterProvider router={router} />)
}

// Nauman asked for this and named the component to build it out of. What it looks in is what somebody looks for by name.
describe('finding a house or a person', () => {
  it('keeps a reading still in flight apart from a ledger with nothing in it', () => {
    // The one sentence on this screen that must never be wrong. `undefined` from Convex is a reading that has not come back; an empty list is an answer. Collapsing them tells a man his house is not there while it is still arriving.
    expect(whatCanBeFound(undefined, [])).toBeUndefined()
    expect(whatCanBeFound([], undefined)).toBeUndefined()
    expect(whatCanBeFound([], [])).toEqual([])
  })

  it('answers a refusal as a refusal rather than as nothing found', () => {
    // `null` is the ledger saying it does not know this sign-in, which comes back through the same door and is also not an empty list. It is answered here rather than left to read as a name nobody has.
    expect(whatCanBeFound(null, [])).toEqual([])
    expect(whatCanBeFound([{ _id: 's1', name: '1-A, Phase 0' }], null)).toEqual([
      { id: 's1', name: '1-A, Phase 0', what: 'House', to: '/sites/s1' },
    ])
  })

  it('draws the shape of what is coming, whatever has been typed', async () => {
    // The half above is a function; this is the sentence it produces. Both, because a correct answer said as the wrong sentence is the whole defect.

    // Drawn as a line of its own rather than through `CommandEmpty`, and this test is what found that out: `cmdk` draws its empty state only when nothing at all matches, and the screens below always match something. A sentence living in there would have gone unsaid every single time -- the reading in flight makes the list *short*, never empty.
    drawIt(undefined)
    expect(await screen.findByRole('status', { name: 'Getting the names' })).toBeTruthy()
    expect(screen.queryByText('Nothing by that name.')).toBeNull()

    // And still said once somebody has typed something no screen matches, which is the moment it matters most: that is exactly when the other sentence would otherwise appear.
    fireEvent.change(screen.getByPlaceholderText('A house, a person, or a screen'), { target: { value: 'zzz' } })

    expect(screen.getByRole('status', { name: 'Getting the names' })).toBeTruthy()
    expect(screen.queryByText('Nothing by that name.')).toBeNull()
  })

  it('says nothing was found only once there is a name that found nothing', async () => {
    // An empty ledger with nothing typed is not "nothing by that name" -- the screens are all still there to go to, and saying it then would be answering a question nobody asked.
    drawIt([])
    await screen.findByText('Screens')

    expect(screen.queryByText('Nothing by that name.')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('A house, a person, or a screen'), { target: { value: 'zzz' } })

    expect(screen.getByText('Nothing by that name.')).toBeTruthy()
  })

  it('sends a house and a person to their own screens', async () => {
    drawIt(FOUND)

    // Read off the option rather than off a click, because `cmdk` selects with its own keyboard handling and what this test is about is where each row points.
    expect(await screen.findByText('1-A, Phase 0')).toBeTruthy()
    expect(screen.getByText('The tile shop')).toBeTruthy()
  })

  it('offers every screen the nav offers, out of the same list', async () => {
    // Written once and read twice, so a destination cannot be in the rail and missing from here. The converse guard in `Shell.test` holds that list to the routes; this holds this screen to that list.
    drawIt(FOUND)
    const screens = (await screen.findByText('Screens')).closest('[cmdk-group]')

    expect(screens, 'the search draws no group of screens at all').not.toBeNull()

    for (const destination of DESTINATIONS) {
      expect(
        within(screens as HTMLElement).getByText(destination.label),
        `${destination.label} is in the nav and not in the search`
      ).toBeTruthy()
    }
  })

  it('narrows to what was typed', async () => {
    drawIt(FOUND)

    fireEvent.change(await screen.findByPlaceholderText('A house, a person, or a screen'), {
      target: { value: 'tile' },
    })

    expect(screen.getByText('The tile shop')).toBeTruthy()
    expect(screen.queryByText('1-A, Phase 0')).toBeNull()
  })

  it('is not the only way in, because a phone has no keyboard to press the shortcut with', () => {
    // The control carries its own words rather than only a glyph. A magnifying glass is the one icon almost everybody reads, and "almost" is doing work on the screen somebody opens to find a house they are owed money on.

    // Drawn on its own, outside a router: it opens a dialog and navigates nowhere.
    render(<WayToFind onOpen={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Find a house or a person' })).toBeTruthy()
  })
})
