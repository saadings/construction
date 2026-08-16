// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChangeTheHouse } from './ChangeTheHouse'
import type { HouseAsTyped } from './HouseDetails'

afterEach(cleanup)

// The one house in production, made while somebody was diagnosing a spinner.
const AS_MADE: HouseAsTyped = {
  name: 'Test Site',
  coveredAreaSqft: '4,975',
  stage: 'building',
  builtForAClient: false,
}

function renderIt(house: HouseAsTyped = AS_MADE, handlers = {}) {
  const all = {
    onSave: vi.fn().mockResolvedValue(undefined),
    onPutAway: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  }

  render(<ChangeTheHouse house={house} {...all} />)

  return all
}

function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit house' }))
}

describe('correcting a house already started', () => {
  it('stays out of the way until it is asked for', () => {
    renderIt()

    expect(screen.queryByLabelText('Name')).toBeNull()

    open()

    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('opens holding what the house already says, so a correction is a correction', () => {
    renderIt()
    open()

    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Test Site')
    expect(screen.getByLabelText<HTMLInputElement>('Covered area').value).toBe('4,975')
    expect(screen.getByRole('radio', { name: 'Ours to sell' }).getAttribute('aria-checked')).toBe('true')
  })

  it('renames the house, which is the whole reason this exists', async () => {
    // Nauman's one house in production is called "Test Site". Without this his real first house sits under a test one forever.
    const { onSave } = renderIt()
    open()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '1-A, Phase 0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: '1-A, Phase 0',
        coveredAreaSqft: '4,975',
        stage: 'building',
        builtForAClient: false,
      })
    })
  })

  it('sends no covered area at all when it is emptied, rather than an empty one', async () => {
    const { onSave } = renderIt()
    open()

    fireEvent.change(screen.getByLabelText('Covered area'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ coveredAreaSqft: undefined }))
    })
  })

  it('asks twice before putting a house away, because it comes off the list', async () => {
    const { onPutAway } = renderIt()
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onPutAway).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, archive' }))

    await waitFor(() => {
      expect(onPutAway).toHaveBeenCalled()
    })
  })

  it('lets go of the second ask, so a misplaced press is not a house put away', () => {
    const { onPutAway } = renderIt()
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Yes, archive' })).toBeNull()
    expect(onPutAway).not.toHaveBeenCalled()
  })

  it('says putting one away is not deleting it, because everything points at a house forever', () => {
    renderIt()
    open()

    expect(screen.getByText(/What was spent on it is still there/)).toBeTruthy()
  })

  it('says what the server said and stays open, so the correction is not lost', async () => {
    renderIt(AS_MADE, { onSave: vi.fn().mockRejectedValue(new ConvexError('Give this site a name.')) })
    open()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Give this site a name.')
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('x')
  })

  it('closes once the correction has gone in', async () => {
    renderIt()
    open()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '1-A, Phase 0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByLabelText('Name')).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Edit house' })).toBeTruthy()
  })
})
