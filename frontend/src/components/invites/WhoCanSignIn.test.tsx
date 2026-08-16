// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Invited } from './WhoCanSignIn'
import { WhoCanSignIn } from './WhoCanSignIn'

afterEach(cleanup)

const WAITING: Array<Invited> = [
  { id: 'inv_1', email: 'mason@example.com', askedOn: 1_760_000_000_000 },
  { id: 'inv_2', email: 'steel@example.com', askedOn: 1_770_000_000_000 },
]

function theEmailBox() {
  return screen.getByLabelText('Email')
}

describe('who can sign in', () => {
  it('lists everyone still waiting, by the address they were asked at', () => {
    render(<WhoCanSignIn waiting={WAITING} onInvite={vi.fn()} onTakeOff={vi.fn()} />)

    const rows = screen.getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('mason@example.com'),
      expect.stringContaining('steel@example.com'),
    ])
  })

  it('says nobody is waiting rather than showing an empty space', () => {
    // A blank space reads as something that has not loaded, which is the same thing an empty list looks like.
    render(<WhoCanSignIn waiting={[]} onInvite={vi.fn()} onTakeOff={vi.fn()} />)

    expect(screen.getByText('Nobody is waiting.')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('claims nothing about invitations that may never have been sent', () => {
    // It said "Everyone invited has signed in" whenever the list was empty -- including on an instance where inviting has never once worked, which is where Nauman read it while working out why it did not. Zero and none-outstanding are the same empty list, and this component cannot tell them apart: it holds `waiting` and nothing else.
    render(<WhoCanSignIn waiting={[]} onInvite={vi.fn()} onTakeOff={vi.fn()} />)

    expect(screen.queryByText(/signed in/i)).toBeNull()
    expect(screen.queryByText(/everyone/i)).toBeNull()
  })

  it('says it is still looking before the answer arrives', () => {
    render(<WhoCanSignIn waiting={null} onInvite={vi.fn()} onTakeOff={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'Getting who is waiting' })).toBeTruthy()
    expect(screen.queryByText('Nobody is waiting.')).toBeNull()
  })

  it('sends what was typed, and clears the box once it has gone', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined)
    render(<WhoCanSignIn waiting={[]} onInvite={onInvite} onTakeOff={vi.fn()} />)

    fireEvent.change(theEmailBox(), { target: { value: 'mason@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }))

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledWith('mason@example.com')
    })
    await waitFor(() => {
      expect((theEmailBox() as HTMLInputElement).value).toBe('')
    })
  })

  it('keeps what was typed when it did not go through, and says why', async () => {
    // Losing the address on a refusal means typing it again, which is the same dead end as a form that empties itself.
    const onInvite = vi.fn().mockRejectedValue(new ConvexError('That does not look like an email address.'))
    render(<WhoCanSignIn waiting={[]} onInvite={onInvite} onTakeOff={vi.fn()} />)

    fireEvent.change(theEmailBox(), { target: { value: 'the mason' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }))

    expect((await screen.findByRole('alert')).textContent).toBe('That does not look like an email address.')
    expect((theEmailBox() as HTMLInputElement).value).toBe('the mason')
  })

  it('says something a person can read when the refusal is not one', async () => {
    // A thrown thing with nothing readable in it is the app failing rather than the person being wrong.
    const onInvite = vi.fn().mockRejectedValue(new Error('TypeError: fetch failed'))
    render(<WhoCanSignIn waiting={[]} onInvite={onInvite} onTakeOff={vi.fn()} />)

    fireEvent.change(theEmailBox(), { target: { value: 'mason@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }))

    const said = await screen.findByRole('alert')
    expect(said.textContent).toBe('That did not go through. Try once more in a moment.')
    expect(said.textContent).not.toMatch(/TypeError|fetch/)
  })

  it('takes the right one off, by the row it was pressed in', async () => {
    const onTakeOff = vi.fn().mockResolvedValue(undefined)
    render(<WhoCanSignIn waiting={WAITING} onInvite={vi.fn()} onTakeOff={onTakeOff} />)

    const steel = screen.getAllByRole('listitem')[1]
    fireEvent.click(within(steel).getByRole('button', { name: 'Take them off' }))

    await waitFor(() => {
      expect(onTakeOff).toHaveBeenCalledWith('inv_2')
    })
  })

  it('says nothing technical anywhere on it', () => {
    // No allowlist, no identifier, no revoke, no provisioning: the words are what he would say.
    render(<WhoCanSignIn waiting={WAITING} onInvite={vi.fn()} onTakeOff={vi.fn()} />)

    expect(document.body.textContent).not.toMatch(
      /allowlist|identifier|revoke|provision|invitation id|token|api|clerk|webhook/i
    )
  })
})
