// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

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
  it('draws something, rather than throwing on the one nobody clicked', async () => {
    for (const showing of ON_SHOW) {
      window.location.hash = showing.slug
      render(<Gallery />)

      // Words that screen shows and no other does, so this is not satisfied by a gallery that answers every address with the first screen. Awaited, because the router matches before it draws, and a screen read too early is empty for a reason that has nothing to do with it.
      const showed = await within(drawn()).findAllByText(showing.proves, { exact: false })

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
