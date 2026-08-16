// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { NEVER_SMALLER_THAN } from './Field'
import { whatSizeItComesTo } from './theSizeOnAPhone'

// const measured it in the gallery, on a phone, on the day sheet: "Which day" came out at 14px while everything around it was 16 to 44. It is the control this app is tapped on most, it is filled on every entry, and iOS Safari zooms the whole page when focus lands in anything under 16px -- and does not zoom back.

// The prediction was already written down in `Field.tsx`; the defect landed on the one look that did not carry a size, where shadcn's own `md:text-sm` came through untouched. A rule about "the size on a phone" living in a comment is not a rule, so this is where it is kept.

// `Day` is here because the control this rule was written about is now one. The 14px that zoomed the page was "Which day", and it stopped being a `Line` the moment the date input became a button and a calendar -- so a list naming the two boxes would have let the very control it exists for out through the gap. Its size is written into the component rather than handed in, which is why nothing here flags it and why this list has to still contain it: the day it takes a `className` again, this is what asks.

/** Every control a person taps into, which is every one that can zoom the page under him. */
const A_BOX = ['Line', 'Lines', 'Day']

/** Whatever tag was opened last. Walked back to from the class list rather than forward from the tag, because `[^>]*` between a tag and its `className` stops dead at the `>` in an arrow function -- the same trap that once made a sweep report nothing at all. */
const A_TAG = /<([A-Za-z][\w.]*)/g

/** Every class list a screen hands a box, said with the tag it was handed to. */
export function whatIsHandedToABox(source: string): Array<{ tag: string; classes: string }> {
  const found: Array<{ tag: string; classes: string }> = []

  for (const written of source.matchAll(/className="([^"]*)"/g)) {
    const opened = [...source.slice(0, written.index).matchAll(A_TAG)]
    const tag = opened.length === 0 ? '' : opened[opened.length - 1][1]

    if (A_BOX.includes(tag)) {
      found.push({ tag, classes: written[1] })
    }
  }

  return found
}

/** What a screen sets a box to, where that is smaller than a person can use. */
export function tooSmallIn(source: string): Array<string> {
  return whatIsHandedToABox(source).flatMap(({ tag, classes }) => {
    const { onAPhone, onADesk } = whatSizeItComesTo(classes)

    return [
      onAPhone !== null && onAPhone < NEVER_SMALLER_THAN ? `<${tag}> is ${onAPhone}px on a phone` : null,
      onADesk !== null && onADesk < NEVER_SMALLER_THAN ? `<${tag}> is ${onADesk}px on a desk` : null,
    ].filter((said) => said !== null)
  })
}

describe('a box a person types into', () => {
  const screens = everyScreen()

  it('is never set smaller than a phone can be tapped on', () => {
    const small = screens.flatMap(({ path, source }) => tooSmallIn(source).map((said) => `${path}: ${said}`))

    expect(small).toEqual([])
  })

  it('is asked of the screens that really ask a question', () => {
    // The floor, counted the way the sweep counts. A reader that stopped finding boxes reports the same clean result as an app where every one of them is big enough.

    // Counted as boxes rather than as class lists, and it took this change to see why. This stood at "more than two class lists", and converting four screens away from `<Line type="date" className="… text-sm" />` took it to two: the sweep is removing its own subject. Left as it was it would have stood at one, then at none, and a floor that falls to nothing while the app is being *fixed* fails looking exactly like a screen nobody opened.
    const boxes = screens.flatMap(({ path, source }) =>
      [...source.matchAll(/<(Line|Lines|Day)\b/g)].map((found) => `${path}: <${found[1]}>`)
    )

    expect(boxes.length).toBeGreaterThan(30)
    expect(boxes.some((said) => said.includes('<Day>'))).toBe(true)

    // And the reader itself still reads a real one off a real screen, which is the half the count above cannot show. No screen is named: the ones that hand a class list to a box today are the ones still to be converted, so naming one is writing down a defect as an anchor.
    const handed = whatIsHandedToABox(screens.map(({ source }) => source).join('\n'))

    expect(handed.length).toBeGreaterThan(0)
  })

  it('would notice the one that was measured, in the shape it really had', () => {
    // Verbatim from the day picker as it shipped: the look brought shadcn's `md:text-sm` and the screen asked for `text-sm` on top of it.
    const shipped =
      '<Line look="beside" type="date" className="text-muted-foreground w-auto shrink-0 text-right text-sm" />'

    expect(tooSmallIn(shipped)).toEqual(['<Line> is 14px on a phone', '<Line> is 14px on a desk'])
  })

  it('notices a size that is only small on a desk, which is the half nobody looks at', () => {
    // The `md:` twin on its own. This is the shape shadcn's own default has, and it is invisible on the device most people check first.
    expect(tooSmallIn('<Line className="text-lg md:text-sm" />')).toEqual(['<Line> is 14px on a desk'])
    expect(tooSmallIn('<Line className="text-sm md:text-lg" />')).toEqual(['<Line> is 14px on a phone'])
  })

  it('reads a size written out as well as one named', () => {
    expect(tooSmallIn('<Line className="text-[0.875rem]" />')).toEqual([
      '<Line> is 14px on a phone',
      '<Line> is 14px on a desk',
    ])
    expect(tooSmallIn('<Line className="text-[13px]" />')).toEqual([
      '<Line> is 13px on a phone',
      '<Line> is 13px on a desk',
    ])
    expect(tooSmallIn('<Line className="text-[2.75rem]" />')).toEqual([])
  })

  it('leaves alone the words that begin like a size and are not one', () => {
    expect(whatSizeItComesTo('text-right text-muted-foreground text-balance')).toEqual({
      onAPhone: null,
      onADesk: null,
    })
    // And a class list handed to something that is not a box is not this rule's business.
    expect(tooSmallIn('<Button look="beside" className="py-2 text-sm" />')).toEqual([])
    expect(tooSmallIn('<span className="text-sm" />')).toEqual([])
  })
})
