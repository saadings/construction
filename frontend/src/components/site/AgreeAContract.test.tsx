// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick } from '../../testing/pick'
import { AgreeAContract } from './AgreeAContract'

afterEach(cleanup)

const PEOPLE = [
  { _id: 'p1', name: 'The one it is built for' },
  { _id: 'p2', name: 'A steel supplier' },
]

function renderIt(onAgree = vi.fn().mockResolvedValue(undefined)) {
  render(<AgreeAContract people={PEOPLE} onAgree={onAgree} />)

  return { onAgree }
}

function fillIn(fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

describe('agreeing what a client is paying', () => {
  it('sends a lump sum as one agreed price, with nothing about a rate on it', async () => {
    // A lump sum carrying a rate is how one of the two gets left behind holding an old figure the day the other changes.
    const { onAgree } = renderIt()

    await pick(userEvent.setup(), 'Who it is for', 'The one it is built for')
    fillIn({
      'Agreed on': '2026-04-01',
      'The whole price': '12,500,000',
      'Area agreed': '2,250',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agree it' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith({
        clientId: 'p1',
        agreedOn: '2026-04-01',
        priced: { how: 'lumpSum', totalPaisa: '12,500,000' },
        agreedAreaSqft: '2,250',
        note: undefined,
      })
    })
  })

  it('sends a rate as a rate, and asks for it in those words', async () => {
    const { onAgree } = renderIt()

    fireEvent.click(screen.getByRole('radio', { name: 'A rate per square foot' }))
    // The one box is now asking a different question, so it is found by the words it is asking.
    await pick(userEvent.setup(), 'Who it is for', 'The one it is built for')
    fillIn({ 'Rate per square foot': '5,500', 'Area agreed': '2,250' })
    fireEvent.click(screen.getByRole('button', { name: 'Agree it' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith(
        expect.objectContaining({ priced: { how: 'ratePerSqft', ratePerSqftPaisa: '5,500' } })
      )
    })
    expect(screen.queryByLabelText('The whole price')).toBeNull()
  })

  it('says a house has to be for somebody, once the eye has left the box', () => {
    renderIt()

    fireEvent.blur(screen.getByLabelText('Who it is for'))

    expect(screen.getByRole('alert').textContent).toBe('Say who the house is being built for.')
  })

  it('holds the area to the same rule the server refuses by', () => {
    // 50 square feet is not a house. The screen and the server say the same sentence because they are the same rule.
    renderIt()

    fillIn({ 'Area agreed': '50' })
    fireEvent.blur(screen.getByLabelText('Area agreed'))

    expect(screen.getAllByRole('alert').map((said) => said.textContent)).toContain('Put in the area in square feet.')
  })

  it('keeps what was typed when it did not go in, and says why', async () => {
    renderIt(vi.fn().mockRejectedValue({ data: 'This house already has a contract.' }))

    await pick(userEvent.setup(), 'Who it is for', 'The one it is built for')
    fillIn({ 'The whole price': '12,500,000', 'Area agreed': '2,250' })
    fireEvent.click(screen.getByRole('button', { name: 'Agree it' }))

    expect((await screen.findByText('This house already has a contract.')).textContent).toBe(
      'This house already has a contract.'
    )
    expect(screen.getByLabelText<HTMLInputElement>('The whole price').value).toBe('12,500,000')
  })

  it('does not turn red under boxes nobody has touched once one has gone in', async () => {
    // The same defect the People screen had: clearing what was typed without clearing that focus had been there leaves a form arguing about answers it just accepted.
    renderIt()

    await pick(userEvent.setup(), 'Who it is for', 'The one it is built for')
    fillIn({ 'The whole price': '12,500,000', 'Area agreed': '2,250' })
    fireEvent.blur(screen.getByLabelText('Area agreed'))
    fireEvent.click(screen.getByRole('button', { name: 'Agree it' }))

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Area agreed').value).toBe('')
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('groups the figures as they are typed, because these are the largest in the app', () => {
    renderIt()

    fillIn({ 'The whole price': '12500000' })

    expect(screen.getByLabelText<HTMLInputElement>('The whole price').value).toBe('12,500,000')
  })
})
