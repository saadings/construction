// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

afterEach(cleanup)

describe('a button that is sending something', () => {
  it('keeps saying what it says, so nothing moves under the finger still on it', () => {
    const { rerender } = render(<Button>Put them in</Button>)
    const idle = screen.getByRole('button').textContent

    rerender(<Button busy>Put them in</Button>)

    // "Put them in" becoming "Putting in…" is a different width, and the button resizes as it is pressed.
    expect(screen.getByRole('button').textContent).toBe(idle)
    expect(idle).toBe('Put them in')
  })

  it('turns itself off, so one day sheet cannot go in twice', () => {
    const onClick = vi.fn()
    render(
      <Button busy onClick={onClick}>
        Put them in
      </Button>
    )

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('says it is working, rather than only drawing it', () => {
    // A turning ring is nothing at all to somebody who cannot see it.
    render(<Button busy>Save it</Button>)

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
  })

  it('says nothing of the sort when it is idle', () => {
    render(<Button>Save it</Button>)

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull()
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
  })

  it('stays off when it is turned off for its own reasons', () => {
    render(<Button disabled>Save it</Button>)

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
    // Off is not the same as sending, and saying it is sending would be a lie a reader is told out loud.
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull()
  })

  it('never submits, because none of these sit in a form', () => {
    // A stray submit reloads the page and loses everything typed into it.
    render(<Button>Save it</Button>)

    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })
})
