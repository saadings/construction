// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The same generator writes the same defect into every overlay it makes.

// const-orc built main, photographed the nav sheet and found the control that takes focus the moment it opens was **16 by 16**: shadcn's line positions the close button and never sizes it, so it collapses to its `size-4` icon. In the picture it read as an empty brass square, because the focus ring was larger than the button it was ringing.

// That was fixed in `sheet.tsx`, and the guard beside it read `sheet.tsx`. Then `shadcn add command` brought `dialog.tsx` in, **with the identical line** -- positioned, unsized, 16px -- and a guard naming one file had nothing to say about it. A dialog is where the search lives, so it would have shipped the same defect on the same day it was fixed.

// So the question is asked of every vendored file at once. What this catches is not one button: it is that a generator's defaults are a *class* of thing arriving in this repository, and the next overlay somebody adds gets asked without anybody remembering to ask.

const VENDORED = 'frontend/src/components/ui'

/** What a thumb needs, which Apple's guidance and WCAG 2.5.5 arrive at separately. Written as the class rather than the number because that is what a source sweep can see; `yarn columns` measures the pixels. */
const A_REAL_TARGET = /(^|\s)(size-11|size-\[44px\]|min-h-11|h-11)(\s|$)/

/** Every close button a vendored overlay draws, with the classes it draws it with. */
function everyCloseButton(): Array<{ file: string; classes: string }> {
  const found: Array<{ file: string; classes: string }> = []

  for (const name of readdirSync(VENDORED)) {
    if (!name.endsWith('.tsx') || name.endsWith('.test.tsx')) continue

    const source = readFileSync(join(VENDORED, name), 'utf8')

    // Anchored on the shape only a drawn close button has: an element whose class list is followed by an icon and the word `Close`. Not on the component's name -- `SheetPrimitive.Close` appears three times in its own file and the first is a type annotation, `React.ComponentProps<typeof SheetPrimitive.Close>`, which draws nothing. A locator that matches more than one thing has a wrong-one that reads exactly like the right one.
    for (const drawn of source.matchAll(
      /className="([^"]*)"\s*>\s*<XIcon[^>]*\/>\s*<span className="sr-only">Close/g
    )) {
      found.push({ file: name, classes: drawn[1] })
    }
  }

  return found
}

describe('what a generator writes into every overlay it makes', () => {
  const buttons = everyCloseButton()

  it('is found at all, rather than reporting a clean nothing about a pattern that has moved', () => {
    // The floor, and it is the one this whole family needs. A regex that stopped matching says exactly what an app with no undersized close buttons says. Two overlays draw one today: the nav's sheet and the dialog the search sits in.
    expect(buttons.map((one) => one.file).sort()).toEqual(['dialog.tsx', 'sheet.tsx'])
  })

  it.each(buttons)('gives a thumb something to hit: $file', ({ file, classes }) => {
    // shadcn's own is `absolute top-4 right-4 rounded-xs` -- position and no size at all -- so the button is whatever its icon is, which is 16.
    expect(classes, `the close button in ${file} is positioned and never sized`).toMatch(A_REAL_TARGET)
  })

  it('keeps the icon where it was while it does it', () => {
    // `top-2 right-2` around a 44px box puts the icon's centre exactly where `top-4 right-4` around a 16px box put it. Asserted because it is the half that makes the fix free: without it, sizing the button moves the glyph 8px down and in on every overlay in the app.
    for (const { file, classes } of buttons) {
      expect(classes, `the close button in ${file} is sized and has moved the icon`).toMatch(/(^|\s)top-2(\s|$)/)
      expect(classes, `the close button in ${file} is sized and has moved the icon`).toMatch(/(^|\s)right-2(\s|$)/)
    }
  })
})
