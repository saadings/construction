// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WayOut } from './WayOut'

afterEach(cleanup)

function classesOn(): string {
  cleanup()
  render(<WayOut>Take it back</WayOut>)

  return screen.getByRole('button').className
}

describe('a way out of something already put in', () => {
  it('is off while it is going, because the second press lands on a different row', () => {
    // Worse than pressing a send twice: by the time the second press happens the row it named has gone, and whatever took its place is what is underneath.
    const onClick = vi.fn()
    render(
      <WayOut busy onClick={onClick}>
        Take it back
      </WayOut>
    )

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('says it is working rather than only drawing it', () => {
    render(<WayOut busy>Take it back</WayOut>)

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
  })

  it('says nothing of the sort when it is idle', () => {
    render(<WayOut>Take it back</WayOut>)

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull()
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
  })

  it('never submits, because none of these sit in a form', () => {
    render(<WayOut>Take it back</WayOut>)

    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })
})

// Built on shadcn's button now rather than on a `<button>`, which is meant to change what it is made of and nothing anybody sees. Three of their defaults had to be undone to keep that true, and all three were found by taking the pictures again and measuring them -- so all three are asserted here, where reading is enough.
describe('what shadcn brings that a way out does not want', () => {
  it('is not the primary colour, because this is not the thing to press', () => {
    // shadcn's `link` is `text-primary`. The whole reason this component exists is that a control which removes a row was reading as a caption on three screens -- and reading as the *send* is the same mistake pointing the other way.
    expect(classesOn()).toContain('text-muted-foreground')
    expect(classesOn()).not.toContain('text-primary')
  })

  it('is not an underline that waits for a pointer', () => {
    // shadcn underlines on hover. This underlines always, and it must: an affordance that appears only once the pointer is on it is no affordance at all on a phone, where there is no pointer.
    expect(classesOn()).toMatch(/(^|\s)underline(\s|$)/)
  })

  it('is not their weight, which would make this the boldest thing on its row', () => {
    expect(classesOn()).toContain('font-normal')
    expect(classesOn()).not.toContain('font-medium')
  })

  it('is not a box of its own, in size or in shape', () => {
    // shadcn's button is a 36px pill with its own padding. This sits on a line of other words, and `inline` rather than `inline-flex` because an inline-flex box takes its baseline from the flex line inside it and sat every row it is on a pixel off.
    expect(classesOn()).toContain('inline')
    expect(classesOn()).not.toContain('inline-flex')
    expect(classesOn()).toContain('h-auto')
    expect(classesOn()).not.toContain('h-9')
    // No padding shadcn's button would give it, which is a different claim from no padding at all. The pair below is what took the place of the `p-0` this used to say, in both directions and for the same reason.
    expect(classesOn()).not.toContain('px-4')
  })

  it('gives a thumb something to hit without moving the row it sits in', () => {
    // The pair, and the pair is the whole trick. `py-3` grows the box a finger lands on from 20px to 44; `-my-3` gives the same 24px back to the layout, so nothing on any row moves -- 68 of the 69 comparable pictures were identical afterwards, and the one that differed was the chart that never draws twice the same.

    // Which is why the floor is written as tappable area rather than as visible size. A rule read as "44px tall" is one somebody argues an exemption out of the first time it would double the height of a dense table; this one needs no exemption at all.

    // The horizontal half is newer and came from the widened sweep: `Cancel` measured 44 high and **43 wide**, because a control drawn as text is exactly as wide as its own word and WCAG 2.5.5 asks for 44 in both directions. `min-width` cannot answer it -- this is `inline`, and `min-width` does not apply to a non-replaced inline box -- so it is the same padding-and-give-it-back sideways.
    expect(classesOn(), 'nothing makes this taller than its own words').toMatch(/(^|\s)py-3(\s|$)/)
    expect(classesOn(), 'the row it sits in moves to make room').toMatch(/(^|\s)-my-3(\s|$)/)
    expect(classesOn(), 'nothing makes this wider than its own word').toMatch(/(^|\s)px-2(\s|$)/)
    expect(classesOn(), 'the row it sits in moves sideways to make room').toMatch(/(^|\s)-mx-2(\s|$)/)
  })

  it('says what it does, so the thing that measures does not have to guess', () => {
    // `yarn columns` finds these by asking the page for `[data-removes]` and measuring what it finds. A probe that worked out what a control is from its colour or its class list would agree with its own guess; this one asks the control.
    render(<WayOut>Take it back</WayOut>)

    expect(screen.getByRole('button').hasAttribute('data-removes')).toBe(true)
  })
})
