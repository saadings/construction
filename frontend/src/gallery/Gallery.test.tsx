// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { tapThrough } from '../testing/tapThrough'
import { Gallery } from './Gallery'
import { ON_SHOW } from './screens'

afterEach(cleanup)

// A gallery that throws on the seventh screen is a gallery nobody finds out about until somebody clicks the seventh button. Every screen is drawn here, once, so a fixture that has gone out of shape is caught by a test rather than by whoever opened the page to look at something else.

// jsdom applies no CSS, so this says nothing about how any of it looks. That is the whole reason the gallery exists; what this proves is only that there is something there to photograph.

function drawn(): HTMLElement {
  // Everything below the gallery's own chrome: the note, the row of buttons and the line saying where a screen lives are not the screen.
  return screen.getByTestId('the-screen')
}

describe('every screen in the gallery', () => {
  // Long enough for the two screens whose subject is a wait: they speak after eight and twelve seconds, and the whole loop runs inside one test.
  it('draws something, rather than throwing on the one nobody clicked', { timeout: 60_000 }, async () => {
    for (const showing of ON_SHOW) {
      window.location.hash = showing.slug
      render(<Gallery />)

      // What a folded screen shows is what it shows after the taps. Two screens here prove words that do not exist until a control has been tapped, and asking those at rest is asking them to be a screen nobody is ever on.
      await tapThrough(showing.tapFirst, drawn())

      // Words that screen shows and no other does, so this is not satisfied by a gallery that answers every address with the first screen. Awaited, because the router matches before it draws, and a screen read too early is empty for a reason that has nothing to do with it.

      // Waited for as long as the screen says its words take: two of them are about a wait, and asking those to prove themselves within a second is asking them to be the thing they are drawn to show.
      const showed = await within(drawn()).findAllByText(
        showing.proves,
        {
          exact: false,
        },
        { timeout: (showing.provesAfter ?? 0) + 4_000 }
      )

      expect(showed.length, `${showing.slug} never drew "${showing.proves}"`).toBeGreaterThan(0)

      cleanup()
    }
  })

  it('would notice a screen that drew the wrong thing', async () => {
    // The control on the loop above, which is only as good as the markers under it. If two screens shared one, the loop would pass with either drawn -- so no two of them do.
    expect(new Set(ON_SHOW.map((showing) => showing.proves)).size).toBe(ON_SHOW.length)

    window.location.hash = 'owed'
    render(<Gallery />)

    // And nothing from another screen came with it.
    expect(within(drawn()).queryByText('204-C, Phase 6')).toBeNull()
    expect(await within(drawn()).findByRole('heading', { name: 'Owed' })).toBeTruthy()
  })

  it('is looking at every screen, rather than at an empty list', () => {
    expect(ON_SHOW.length).toBeGreaterThan(10)
    expect(ON_SHOW.map((showing) => showing.slug)).toContain('shares')
  })

  it('says on the page that none of it is the ledger, wherever somebody lands', () => {
    window.location.hash = 'people'
    render(<Gallery />)

    expect(screen.getByRole('note').textContent).toMatch(/Nothing here is the ledger/)
  })
})

describe('the gallery in front of a camera', () => {
  afterEach(() => {
    window.history.replaceState({}, '', window.location.pathname)
  })

  function forACamera() {
    window.history.replaceState({}, '', '?camera')
  }

  it('takes its own furniture out of the layout, rather than making it smaller', () => {
    // Hiding it was the second wrong answer. The banner and the chips came to 287px of an 844px phone, and at that height the day sheet's amount box sat under its own footer -- so a picture of that would have shown a bug that is not there. What is drawn has to be the app and nothing else.
    forACamera()
    window.location.hash = 'day-sheet'
    render(<Gallery />)

    expect(screen.queryByRole('button', { name: 'What each partner takes' })).toBeNull()
    expect(screen.queryByText('a house, then the day sheet')).toBeNull()
  })

  it('keeps saying it is not the ledger, because that is the half a photograph carries away', () => {
    forACamera()
    window.location.hash = 'day-sheet'
    render(<Gallery />)

    expect(screen.getByRole('note').textContent).toMatch(/Nothing here is the ledger/)
  })

  it('still draws the screen it was asked for', async () => {
    // The floor. Everything above is satisfied by a camera mode that draws nothing at all.
    forACamera()
    window.location.hash = 'owed'
    render(<Gallery />)

    expect(await within(drawn()).findByRole('heading', { name: 'Owed' })).toBeTruthy()
  })

  it('leaves the furniture there for somebody looking rather than photographing', () => {
    // The other end: a camera mode that was always on would be a gallery nobody could get around.
    window.location.hash = 'day-sheet'
    render(<Gallery />)

    expect(screen.getByRole('button', { name: 'What each partner takes' })).toBeTruthy()
    expect(screen.getByText('a house, then the day sheet')).toBeTruthy()
  })
})
