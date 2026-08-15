// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { SiteRow } from './SitesList'
import { SitesList } from './SitesList'

afterEach(cleanup)

// The rows carry links, so they need somewhere to point. Nothing here is being tested about routing itself.
function renderAt(sites: Array<SiteRow>) {
  const root = createRootRoute()
  const home = createRoute({ getParentRoute: () => root, path: '/', component: () => <SitesList sites={sites} /> })
  const nowhere = createRoute({ getParentRoute: () => root, path: '$', component: () => null })
  const router = createRouter({
    routeTree: root.addChildren([home, nowhere]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(<RouterProvider router={router} />)
}

const aHouse: SiteRow = {
  _id: 's1',
  name: '1-A, Phase 0',
  stage: 'building',
  builtForAClient: false,
  spentPaisa: 497498000,
}

describe('the sites on the home screen', () => {
  it('gives each site its name, where it has got to and one number', async () => {
    renderAt([aHouse])

    const row = await screen.findByRole('listitem')
    expect(within(row).getByText('1-A, Phase 0')).toBeTruthy()
    expect(within(row).getByText('Building')).toBeTruthy()
    // Comma grouped, no decimals unless the figure has them, the way the workbooks write it.
    expect(within(row).getByText('4,974,980')).toBeTruthy()
  })

  it('says a client job is one', async () => {
    renderAt([{ ...aHouse, builtForAClient: true, stage: 'complete' }])

    const row = await screen.findByRole('listitem')
    // "Complete" is what the stage is called underneath; "Finished" is what a person calls it.
    expect(within(row).getByText(/Finished/)).toBeTruthy()
    expect(within(row).getByText(/For a client/)).toBeTruthy()
  })

  it('has something to say when there are no sites yet', async () => {
    renderAt([])

    expect(await screen.findByText(/No houses yet/)).toBeTruthy()
    // An empty screen with no way forward is a dead end, so the way to start one is still there.
    expect(screen.getByText('Start a site')).toBeTruthy()
  })

  it('never puts a technical word on the screen', async () => {
    renderAt([aHouse, { ...aHouse, _id: 's2', name: '478-R, Phase 0', builtForAClient: true, stage: 'sold' }])

    await screen.findAllByRole('listitem')
    const onScreen = document.body.textContent.toLowerCase()

    for (const technical of [
      'record',
      'entry',
      'entity',
      'ledger',
      'sync',
      'category',
      'vendor',
      'field',
      'validation',
      'required',
      'error',
      'database',
      'query',
    ]) {
      expect(onScreen).not.toContain(technical)
    }
    // The control: the loop above passes against a blank screen.
    expect(onScreen).toContain('1-a, phase 0')
  })
})
