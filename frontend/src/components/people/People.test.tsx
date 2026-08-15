// @vitest-environment jsdom
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PersonRow } from './People'
import { People } from './People'

afterEach(cleanup)

const EVERYONE: Array<PersonRow> = [
  { _id: 'p1', name: 'A mason', phone: '0300-0000000', notes: 'Civil labour, lump sum' },
  { _id: 'p2', name: 'A steel supplier' },
]

// The screen carries no links, but it is rendered where it really lives so a router-only failure cannot hide here.
function renderWith(people: Array<PersonRow> | null | undefined, onAdd = vi.fn(), onHide = vi.fn()) {
  const root = createRootRoute({ component: () => <People people={people} onAdd={onAdd} onHide={onHide} /> })
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) })

  render(<RouterProvider router={router} />)

  return { onAdd, onHide }
}

describe('the people in the ledger', () => {
  it('lists everyone, with what is known about them', async () => {
    renderWith(EVERYONE)

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).getByText('A mason')).toBeTruthy()
    expect(within(rows[0]).getByText('0300-0000000')).toBeTruthy()
    // Nothing known is a dash rather than a gap, so a row does not read as half-loaded.
    expect(within(rows[1]).getByText('—')).toBeTruthy()
  })

  it('says what to do when there is nobody yet', async () => {
    renderWith([])

    // Nauman's words: they should be able to add the partners, the contractors.
    expect(await screen.findByText(/Add the partners and the contractors/)).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('says it is still looking before the answer arrives', async () => {
    renderWith(undefined)

    // The shape of the list that is coming, rather than a word telling somebody to wait for it.
    expect(await screen.findByRole('status', { name: 'Getting the people' })).toBeTruthy()
    expect(screen.queryByText(/Nobody yet/)).toBeNull()
  })

  it('does not say it is looking once the answer has come back and said no', async () => {
    // The permanent spinner. A refused read is not a slow one, and telling somebody to wait is telling them to wait for something that has already happened.
    renderWith(null)

    expect(await screen.findByText('Setting your sign-in up.')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    // And nothing to fill in, because every one of these would be refused by the same ledger.
    expect(screen.queryByLabelText('Name')).toBeNull()
  })

  it('adds somebody with only a name, because a number is often not known', async () => {
    const { onAdd } = renderWith([], vi.fn().mockResolvedValue(undefined))
    await screen.findByLabelText('Name')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A steel supplier' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add them' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: 'A steel supplier', phone: undefined, notes: undefined })
    })
  })

  it('clears the form once they have gone in, so the next one starts empty', async () => {
    renderWith([], vi.fn().mockResolvedValue(undefined))
    await screen.findByLabelText('Name')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A mason' } })
    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '0300-0000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add them' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('')
    })
    expect(screen.getByLabelText<HTMLInputElement>('Number').value).toBe('')
  })

  it('keeps what was typed when it did not go in, and says why', async () => {
    renderWith([], vi.fn().mockRejectedValue({ data: 'Put in the name of the person or shop paid.' }))
    await screen.findByLabelText('Name')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add them' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Put in the name of the person or shop paid.')
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('A')
  })

  it('says a number is not one only once the eye has left it', async () => {
    renderWith([])
    await screen.findByLabelText('Number')

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '042-35880000' } })
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.blur(screen.getByLabelText('Number'))

    expect(screen.getByRole('alert').textContent).toBe('Put in a mobile number, like 0300-0000000.')
  })

  it('leaves an empty number alone, because most people have none written down', async () => {
    renderWith([])
    await screen.findByLabelText('Number')

    fireEvent.focus(screen.getByLabelText('Number'))
    fireEvent.blur(screen.getByLabelText('Number'))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('takes the right one off the list', async () => {
    const { onHide } = renderWith(EVERYONE, vi.fn(), vi.fn().mockResolvedValue(undefined))

    const rows = await screen.findAllByRole('listitem')
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Take off the list' }))

    await waitFor(() => {
      expect(onHide).toHaveBeenCalledWith('p2')
    })
  })

  it('says nothing technical anywhere on it', async () => {
    renderWith(EVERYONE)
    await screen.findAllByRole('listitem')

    expect(document.body.textContent).not.toMatch(
      /record|entity|vendor|field|validation|required|database|query|hidden|delete/i
    )
  })
})
