// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Field, Line } from './Field'

afterEach(cleanup)

// A field as a screen really uses it: what is wrong is worked out on every keystroke and handed in, and `Field` alone decides when it is said.
function ACoveredArea({ problemWith }: { problemWith: (typed: string) => string | null }) {
  const [typed, setTyped] = useState('')

  return (
    <Field label="Covered area" hint="In square feet." problem={problemWith(typed)}>
      <Line
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value)
        }}
        aria-label="Covered area"
      />
    </Field>
  )
}

const TOO_SMALL = 'That is too small for a house. The least this takes is 100 square feet.'
const tooSmall = (typed: string) => (typed !== '' && Number(typed) < 100 ? TOO_SMALL : null)

function theBox() {
  return screen.getByLabelText('Covered area')
}

describe('a problem beside the field you have just left', () => {
  it('says nothing while it is still being typed in', () => {
    // A form arguing mid-keystroke is a form fighting the person filling it in: 5 is on the way to 5,000.
    render(<ACoveredArea problemWith={tooSmall} />)

    fireEvent.change(theBox(), { target: { value: '5' } })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('In square feet.')).toBeTruthy()
  })

  it('says it the moment the eye moves on', () => {
    render(<ACoveredArea problemWith={tooSmall} />)

    fireEvent.change(theBox(), { target: { value: '50' } })
    fireEvent.blur(theBox())

    expect(screen.getByRole('alert').textContent).toBe(TOO_SMALL)
    // The hint has said its piece; two sentences under one box is a wall.
    expect(screen.queryByText('In square feet.')).toBeNull()
  })

  it('follows every keystroke afterwards, rather than waiting to be left again', () => {
    render(<ACoveredArea problemWith={tooSmall} />)

    fireEvent.change(theBox(), { target: { value: '50' } })
    fireEvent.blur(theBox())
    expect(screen.getByRole('alert')).toBeTruthy()

    fireEvent.change(theBox(), { target: { value: '5000' } })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('In square feet.')).toBeTruthy()
  })

  it('marks the box itself, and only while something is being said about it', () => {
    render(<ACoveredArea problemWith={tooSmall} />)
    expect(theBox().getAttribute('aria-invalid')).toBeNull()

    fireEvent.change(theBox(), { target: { value: '50' } })
    fireEvent.blur(theBox())
    expect(theBox().getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(theBox(), { target: { value: '5000' } })
    expect(theBox().getAttribute('aria-invalid')).toBeNull()
  })

  it('points the box at whatever is written under it', () => {
    render(<ACoveredArea problemWith={tooSmall} />)

    const hint = theBox().getAttribute('aria-describedby')
    expect(hint).not.toBeNull()
    expect(document.getElementById(hint ?? '')?.textContent).toBe('In square feet.')

    fireEvent.change(theBox(), { target: { value: '50' } })
    fireEvent.blur(theBox())

    expect(document.getElementById(theBox().getAttribute('aria-describedby') ?? '')?.textContent).toBe(TOO_SMALL)
  })

  it('says nothing at all when there is nothing wrong', () => {
    // The control. Without it every check above passes against a `Field` that has simply been made silent.
    render(<ACoveredArea problemWith={() => null} />)

    fireEvent.change(theBox(), { target: { value: '50' } })
    fireEvent.blur(theBox())

    expect(screen.queryByRole('alert')).toBeNull()
    expect(theBox().getAttribute('aria-invalid')).toBeNull()
  })

  it('leaves a field nobody has touched alone', () => {
    // Opening a form is not a mistake. Everything empty must not turn red before anything has been asked of it.
    render(<ACoveredArea problemWith={() => 'Put in the covered area in figures, like 4,975.'} />)

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
