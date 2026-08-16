// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Day } from './Day'
import type { Look } from './Field'
import { Field, Line, Lines, NEVER_SMALLER_THAN } from './Field'
import { Pick } from './Pick'
import { whatDecidesTheSizeOf, whatSizeItComesTo } from './theSizeOnAPhone'

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

  it('points at the control it names, whichever control that is', () => {
    // The label is the biggest target on the screen -- on a phone "Who was paid" is wider and taller than the box under it -- and tapping it does nothing unless something carries the id it points at.

    // `Field` hands that id through context and only `Line` and `Lines` were reading it. `Pick` never did, `Day` copied `Pick`, and between them that is every picker and every date in the app: ten-plus call sites where the obvious thing to touch is dead. Nothing failed, because nothing asked.
    for (const [what, draw] of [
      ['Line', () => <Line value="" onChange={() => {}} />],
      ['Lines', () => <Lines />],
      ['Pick', () => <Pick label="What for" chosen={null} choices={[]} onPick={() => {}} />],
      ['Day', () => <Day label="What for" value="2026-07-16" onPick={() => {}} />],
    ] as const) {
      cleanup()
      // `Pick` and `Day` bring their own `Field`, so they are drawn alone and the others are wrapped.
      render(what === 'Pick' || what === 'Day' ? draw() : <Field label="What for">{draw()}</Field>)

      const label = document.querySelector<HTMLLabelElement>('label')
      const named = document.getElementById(label?.htmlFor ?? '')

      expect(label, `${what} draws no label at all`).not.toBeNull()
      expect(label?.htmlFor, `${what}'s label points at nothing`).not.toBe('')
      expect(named, `${what}'s label points at an id no element has`).not.toBeNull()

      // An id that matches a `<div>` satisfies everything above and does nothing under a thumb: only these four take a click from a label. Asked as the tag rather than as `label.control`, which jsdom does not implement.
      expect(
        ['input', 'textarea', 'select', 'button'],
        `${what}'s label points at a <${named?.tagName.toLowerCase() ?? '?'}>, which cannot be labelled`
      ).toContain(named?.tagName.toLowerCase())

      // And it is the control this field is about, rather than something else that happens to be labelable -- a picker's own dropdown holds a button too.
      expect(named, `${what}'s label points at something outside the control`).toBe(
        screen.getByRole(what === 'Pick' ? 'combobox' : what === 'Day' ? 'button' : 'textbox')
      )
    }
  })

  it('puts the tap through to the control, which is what the pointing is for', () => {
    // The wiring above is not the point; this is. A matching id is a fact about the document, and what a person does is put a thumb on the words. Asserted as the outcome -- the calendar opens -- so that an id which matches something that is not the control still fails.
    render(<Day label="Agreed on" value="2026-07-16" onPick={() => {}} />)

    expect(screen.queryByRole('grid')).toBeNull()

    fireEvent.click(screen.getByText('Agreed on'))

    expect(screen.getByRole('grid')).toBeTruthy()
  })

  it('marks the control itself as wrong, whichever control it is', () => {
    // `Field` says what is wrong underneath; the control has to say it is the one being talked about, or a screen reader is read a complaint attached to nothing. Asserted for `Day` because nothing did: it has taken a `problem` since the day it shipped, handed it to `Field`, and never worn the answer.
    render(<Day label="Agreed on" problem="Say which day it was." value="" onPick={() => {}} />)

    const control = screen.getByRole('button', { name: 'Agreed on: no day chosen' })

    expect(control.getAttribute('aria-invalid'), 'red before anybody has left it').toBeNull()

    fireEvent.blur(control)

    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(control.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Say which day it was.'
    )
  })

  // A row of choices is named the other way round -- a group pointing at its label rather than a label pointing at one control -- which is why it is a separate thing from `Field` and is asked about in `aRowOfChoices.test.tsx`.
})

describe('what shadcn brings that this app has to undo', () => {
  // Each of these is one of their defaults meeting one of ours in the same class list. What is asserted is the outcome of the merge, not the presence of a word: a class that lost is gone from the string entirely, so a neutraliser that stopped working shows up as their value coming back.
  function classesOn(control: 'line' | 'lines', look?: Look): string {
    render(
      <Field label="Covered area">
        {control === 'line' ? <Line look={look} value="" onChange={() => {}} /> : <Lines look={look} />}
      </Field>
    )

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

  it('leaves no box this app draws smaller than a person can use, whichever draws it', () => {
    // Every component that puts a box on a screen, not only the two built on `Line`. `Pick` is the one that proves the point: it goes through shadcn's combobox rather than through a look, so nothing above covered it, and it was 14px on ten call sites at every width above `md`.
    for (const [what, draw] of [
      ['Pick', () => <Pick label="What for" chosen={null} choices={[]} onPick={() => {}} />],
      [
        'Line',
        () => (
          <Field label="What for">
            <Line value="" onChange={() => {}} />
          </Field>
        ),
      ],
      [
        'Lines',
        () => (
          <Field label="What for">
            <Lines />
          </Field>
        ),
      ],
    ] as const) {
      render(draw())
      const { onAPhone, onADesk } = whatSizeItComesTo(whatDecidesTheSizeOf(screen.getByLabelText('What for')))

      expect(onAPhone, `${what} is ${onAPhone}px on a phone`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)
      expect(onADesk, `${what} is ${onADesk}px on a desk`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)

      cleanup()
    }
  })

  it('leaves no look of any kind small enough to zoom a phone', () => {
    // The half the sweep beside this cannot see. It reads what a *screen* hands a box; this reads what the box brings on its own, which is where the defect actually was — `beside` carried shadcn's `md:text-sm` through untouched, and the day picker came out at 14px on the control this app is tapped on most.
    for (const look of ['asked', 'beside', 'amount'] as const) {
      for (const control of ['line', 'lines'] as const) {
        const { onAPhone, onADesk } = whatSizeItComesTo(classesOn(control, look))

        expect(onAPhone, `${control} as ${look} sets no size at all`).not.toBeNull()
        expect(onAPhone, `${control} as ${look} is ${onAPhone}px on a phone`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)
        expect(onADesk, `${control} as ${look} is ${onADesk}px on a desk`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)

        cleanup()
      }
    }
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
