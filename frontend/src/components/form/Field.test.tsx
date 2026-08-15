// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Choices, Field, Line, Lines } from './Field'

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

describe('a question asked as a group rather than wrapped in a label', () => {
  it('names its box by pointing at it, with nothing said on the box itself', () => {
    // The whole of what changed. It used to be a `<label>` with everything inside it, where the naming was implicit and the first control took it whether or not it was the one meant. Now the label points at an id the field hands the control, so no screen writes one and none can forget one.
    render(
      <Field label="Covered area" hint="In square feet.">
        <Line value="" onChange={() => {}} />
      </Field>
    )

    const box = screen.getByLabelText('Covered area')

    expect(box.tagName).toBe('INPUT')
    expect(box.getAttribute('aria-label')).toBeNull()
    expect(box.closest('label')).toBeNull()
    expect(box.id).not.toBe('')
    expect(document.querySelector(`label[for="${box.id}"]`)?.textContent).toBe('Covered area')
  })

  it('is a group, so what it holds is not named by being first inside it', () => {
    render(
      <Field label="Covered area">
        <Line value="" onChange={() => {}} />
      </Field>
    )

    expect(screen.getByRole('group')).toBeTruthy()
  })

  it('hands the same wiring to a box of several lines', () => {
    render(
      <Field label="What it is for" hint="Optional.">
        <Lines value="" onChange={() => {}} />
      </Field>
    )

    const box = screen.getByLabelText('What it is for')

    expect(box.tagName).toBe('TEXTAREA')
    expect(document.getElementById(box.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Optional.')
  })

  it('has one id to give, which is why one field holds one control', () => {
    // The reason the rule survived the rebuild, and a different reason from the one it had. Under a `<label>` the second control was merely unnamed; here both are handed the same id, so the document has two elements answering to one name and the label points at whichever comes first. `oneFieldOneControl` is what keeps this off the screens.
    render(
      <Field label="Name">
        <Line value="" onChange={() => {}} />
        <Line value="" onChange={() => {}} />
      </Field>
    )

    const [first, second] = [...document.querySelectorAll('input')]

    expect(first.id).toBe(second.id)
    expect(document.getElementById(first.id)).toBe(first)
  })

  it('names a row of choices as a whole, since no one of them is the answer', () => {
    // A radio group cannot be named by `htmlFor`: it is not one control. It is named by pointing the other way, which is why `Choices` is still a separate thing from `Field`.
    render(
      <Choices label="How paid">
        <button role="radio" aria-checked="false" type="button">
          Cheque
        </button>
      </Choices>
    )

    expect(screen.getByRole('radiogroup', { name: 'How paid' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Cheque' })).toBeTruthy()
  })
})

describe('what shadcn brings that this app has to undo', () => {
  // Each of these is one of their defaults meeting one of ours in the same class list. What is asserted is the outcome of the merge, not the presence of a word: a class that lost is gone from the string entirely, so a neutraliser that stopped working shows up as their value coming back.
  function classesOn(control: 'line' | 'lines'): string {
    render(<Field label="Covered area">{control === 'line' ? <Line value="" onChange={() => {}} /> : <Lines />}</Field>)

    return screen.getByLabelText('Covered area').className
  }

  it('is undone on a line, and each of theirs is really gone', () => {
    const classes = classesOn('line')

    // A fixed 36px box clips text set at this size.
    expect(classes).toContain('h-auto')
    expect(classes).not.toContain('h-9')
    // Theirs drops to `text-sm` above `md`, which would shrink every answer in the app on a desk.
    expect(classes).toContain('md:text-lg')
    expect(classes).not.toContain('md:text-sm')
    // A shadow under a line with no box round it draws a box that is not there.
    expect(classes).toContain('shadow-none')
    expect(classes).not.toContain('shadow-xs')
    // And a ring round a control with no border is a rectangle round nothing.
    expect(classes).toContain('focus-visible:ring-0')
    expect(classes).not.toContain('focus-visible:ring-[3px]')
    // The line under the answer, which is the whole look of this form.
    expect(classes).toContain('rounded-none')
    expect(classes).not.toContain('rounded-md')
    expect(classes).toContain('border-b-2')
  })

  it('is undone on a box of several lines too', () => {
    const classes = classesOn('lines')

    expect(classes).toContain('min-h-0')
    expect(classes).not.toContain('min-h-16')
    expect(classes).toContain('md:text-lg')
    expect(classes).not.toContain('md:text-sm')
    expect(classes).toContain('rounded-none')
    expect(classes).not.toContain('rounded-md')
  })
})
