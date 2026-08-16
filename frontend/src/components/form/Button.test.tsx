// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './Button'
import { NEVER_SMALLER_THAN } from './Field'
import { whatSizeItComesTo } from './theSizeOnAPhone'

afterEach(cleanup)

function classesOn(look?: 'send' | 'beside' | 'another' | 'removing', className?: string): string {
  cleanup()
  render(
    <Button look={look} className={className}>
      Put them in
    </Button>
  )

  return screen.getByRole('button').className
}

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
    // A stray submit reloads the page and loses everything typed into it. shadcn's button says nothing about `type`, so without this it is a submit the day one of these lands inside a form.
    render(<Button>Save it</Button>)

    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })
})

// This was a `<button>` written by hand and is now shadcn's, which is meant to change what it is made of and nothing anybody sees. Four of their defaults had to be undone to keep that true, and each was found by taking the pictures again rather than by reading the class list -- so each is asserted here as the outcome of the merge, where reading it is enough.
describe('what shadcn brings that this button does not want', () => {
  it('is not their text size, on a control this app is pressed on all day', () => {
    // `text-sm` is 14px. Asked as the size it comes to rather than as the absence of a class, because a size can arrive under any name.
    for (const look of ['send', 'beside'] as const) {
      const { onAPhone, onADesk } = whatSizeItComesTo(classesOn(look))

      expect(onAPhone, `as ${look} it sets no size at all`).not.toBeNull()
      expect(onAPhone, `as ${look} it is ${String(onAPhone)}px on a phone`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)
      expect(onADesk, `as ${look} it is ${String(onADesk)}px on a desk`).toBeGreaterThanOrEqual(NEVER_SMALLER_THAN)
    }
  })

  it('is not their fixed height, which cuts this padding off', () => {
    expect(classesOn()).toContain('h-auto')
    expect(classesOn()).not.toContain('h-9')
    expect(classesOn()).toContain('py-3')
  })

  it('is not their refusal to wrap or to give way', () => {
    // The day sheet's bottom bar puts two of these side by side at 390. A button that will not wrap overflows the row instead of shortening itself, and one that will not shrink pushes the other out.
    expect(classesOn()).toContain('whitespace-normal')
    expect(classesOn()).not.toContain('whitespace-nowrap')
    expect(classesOn()).not.toMatch(/(^|\s)shrink-0(\s|$)/)
  })

  it('is not their filled background under a bordered one', () => {
    // `beside` is a border round what is behind it. shadcn's `outline` fills it and puts a shadow under it, and neither was ever there.
    expect(classesOn('beside')).toContain('bg-transparent')
    expect(classesOn('beside')).not.toContain('bg-background')
    expect(classesOn('beside')).toContain('shadow-none')
    expect(classesOn('beside')).not.toContain('shadow-xs')
  })

  it('leaves the padding to whoever writes it, rather than to a variant nothing can beat', () => {
    // This is the one that cost a screen. shadcn sets padding behind `has-[>svg]:px-3` for a button with an icon in it, and `cn` does not merge a plain `px-3` written at a call site over a variant of it -- so "Bill it" on a stage row would have grown by 8px without anybody touching it. The padding this app writes is asked first, because "a call site wins" is also what nobody writing any padding at all looks like.
    expect(classesOn(), 'the button sets no padding of its own').toMatch(/(^|\s)px-5(\s|$)/)

    expect(classesOn(undefined, 'px-3 py-1')).toMatch(/(^|\s)px-3(\s|$)/)
    // Asked on the word rather than on the substring: `has-[>svg]:px-5` is still in the list and still says 5, and it is there deliberately -- an icon handed in by a call site should get the same padding as the label does. What must not survive is the *plain* `px-5`, because that is the one `px-3` was written to replace.
    expect(classesOn(undefined, 'px-3 py-1')).not.toMatch(/(^|\s)px-5(\s|$)/)
  })

  it('gives an icon handed in by a screen the padding this app writes, not the one shadcn writes', () => {
    // The other end of the same variant, and the one the wrapper does not answer: a screen that puts an icon straight inside a `Button` makes `has-[>svg]` match after all, and shadcn's answer is `px-3` where every other button here is `px-5`. Nothing does this today, which is exactly why it is worth holding -- it is a trap laid for whoever does it first.
    cleanup()
    render(
      <Button>
        <svg aria-hidden />
        Put them in
      </Button>
    )

    const classes = screen.getByRole('button').className

    expect(classes).toContain('has-[>svg]:px-5')
    expect(classes).not.toContain('has-[>svg]:px-3')
  })

  it('gives a thumb something to hit on the look that removes a row', () => {
    // Measured for real in `yarn columns`, at 390, in a browser -- for every control that removes something **except these four**. `removing` is the press behind an are-you-sure, and every screen is photographed at rest, so the confirming step is never on the page when the measuring runs.

    // So this is the weaker instrument standing in for the stronger one: it reads what was written rather than what was drawn. Said plainly, because a class list that says `py-3` is not the same fact as a box that measured 44px, and the two are only equal while nothing else is fighting for the height.

    // The pair is the point. `py-3` grows the box a finger lands on by 24px; `-my-3` gives the same 24 back to the layout, so no row moves. Thirteen of the thirteen controls this app has for removing a row were 20px high before it.
    expect(classesOn('removing'), 'nothing makes this bigger than its own words').toMatch(/(^|\s)py-3(\s|$)/)
    expect(classesOn('removing'), 'the row it sits in moves to make room').toMatch(/(^|\s)-my-3(\s|$)/)
  })

  it('says what it does, so the thing that measures does not have to guess', () => {
    // `yarn columns` finds these by asking the page for `[data-removes]`. A probe that worked out what a control is from its colour or its class list would agree with its own guess; this one asks the control.
    cleanup()
    render(<Button look="removing">Yes, take it out</Button>)
    expect(screen.getByRole('button').hasAttribute('data-removes')).toBe(true)

    // And the other looks must not say it, or the measurement is of every button in the app and the floor stops being about the ones where a mis-tap costs a row.
    for (const look of ['send', 'beside', 'another'] as const) {
      cleanup()
      render(<Button look={look}>Put them in</Button>)
      expect(screen.getByRole('button').hasAttribute('data-removes'), `${look} claims to remove something`).toBe(false)
    }
  })

  it('keeps the turning ring out of reach of that variant, which is why it is wrapped', () => {
    // The other half of the same fix, and the half a class list cannot show: `has-[>svg]` matches a *direct* child, so the ring has to not be one. Asked of the document, because a wrapper somebody removes as tidying would put the padding back and nothing above would notice.
    render(<Button busy>Put them in</Button>)

    const button = screen.getByRole('button')

    expect(button.querySelector(':scope > svg'), 'the ring is a direct child again').toBeNull()
    expect(button.querySelector('svg'), 'there is no ring at all').not.toBeNull()
  })
})
