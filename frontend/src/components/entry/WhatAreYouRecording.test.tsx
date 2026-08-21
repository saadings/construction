// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { WhatAreYouRecording } from './WhatAreYouRecording'

afterEach(cleanup)

// Awaited on purpose everywhere below. The router draws on a tick, and anything asked before it has drawn is asked of an empty body -- which is the same answer as a control that is not there.
async function open() {
  const root = createRootRoute({ component: () => <WhatAreYouRecording /> })
  const kids = ['/daybook', '/money-in/new'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null })
  )
  const router = createRouter({
    routeTree: root.addChildren(kids),
    history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
  })

  render(<RouterProvider router={router} />)

  return await screen.findByRole('button', { name: 'New entry' })
}

describe('the question behind `New entry`', () => {
  it('asks which of the two ledgers this is going into', async () => {
    // The whole app turns on that separation: a payment is a cost and somebody is owed for it, a receipt is not a cost and nobody is owed anything because of it. A single `Add` that guessed from context is the one control that could file a partner's capital as an expense.
    const user = userEvent.setup()
    await user.click(await open())

    expect(await screen.findByText('What are you recording?')).toBeTruthy()
    expect(screen.getByText('The two ledgers are kept apart. Pick the direction the money moved.')).toBeTruthy()
  })

  it('gives each direction somewhere it can actually be recorded', async () => {
    // Both, and asked as addresses rather than as words. `Receipts` used to be a list you could read and not write to, so this card would have landed on a screen with no way to record anything -- which is the dead end this app has fixed twice, and a chooser whose second option is worse than not choosing teaches somebody not to use it.

    // His own two words, ruled after the drawing: "Money Come in should be Receipts, and Money Going out should be called payments."
    const user = userEvent.setup()
    await user.click(await open())

    expect((await screen.findByRole('link', { name: /Payments/ })).getAttribute('href')).toBe('/daybook')
    expect(screen.getByRole('link', { name: /Receipts/ }).getAttribute('href')).toBe('/money-in/new')
  })

  it('says what each one is for, in his own words', async () => {
    const user = userEvent.setup()
    await user.click(await open())

    expect(await screen.findByText('A payment to a supplier, subcontractor or labour.')).toBeTruthy()
    expect(screen.getByText('Partner capital, a client payment, or a house sold.')).toBeTruthy()
  })

  it('is closed until it is asked for', async () => {
    // A dialog that opens itself is a dialog somebody dismisses without reading, and the header holds this on every screen in the app.
    expect(await open()).toBeTruthy()

    expect(screen.queryByText('What are you recording?')).toBeNull()
  })

  it('offers his own way out as well as the one shadcn draws', async () => {
    // His footer is a `Cancel` on its own rule. The `X` in the corner is shadcn's and stays -- taking it out is a change to every dialog in the app, and it is the one dismissal a keyboard reaches first.
    const user = userEvent.setup()
    await user.click(await open())
    await screen.findByText('What are you recording?')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('What are you recording?')).toBeNull()
  })

  it('closes behind whichever was chosen', async () => {
    // Left open over the screen it just opened, it is a thing to dismiss -- and the dismissal is what gets forgotten while holding a cheque book.
    const user = userEvent.setup()
    await user.click(await open())
    await user.click(await screen.findByRole('link', { name: /Payments/ }))

    expect(screen.queryByText('What are you recording?')).toBeNull()
  })
})
