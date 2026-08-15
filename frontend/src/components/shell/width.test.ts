import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The complaint that started the redesign: a narrow column centred in a wide dark void, with two-thirds of the screen empty below the button. Mobile-only, called mobile-first.

// Read from the repository root, because under jsdom `import.meta.url` is an http address and not a path to anything.
const SCREENS = 'frontend/src'

function everySourceFile(from: string): Array<string> {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)

    if (entry.isDirectory()) {
      return everySourceFile(path)
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const SOURCE = everySourceFile(SCREENS).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

describe('the width a screen is allowed to take', () => {
  it('is not capped at a phone anywhere', () => {
    // `max-w-lg` is the exact cap that was on every page container. A table of payments is the reason a desk is wider than a phone.
    const capped = SOURCE.filter((file) => file.text.includes('max-w-lg')).map((file) => file.path)

    expect(capped).toEqual([])
  })

  it('is looking at the screens, and would notice one that put the cap back', () => {
    // The control. Without it this passes just as well against a list of no files at all.
    expect(SOURCE.length).toBeGreaterThan(15)
    expect(SOURCE.some((file) => file.text.includes('max-w-2xl'))).toBe(true)
  })

  it('caps a form inside the content rather than capping the page around it', () => {
    // A form reads badly at 1440px: the eye loses the line between a label and the box it belongs to. A table does not, so the cap belongs to the form.
    const page = SOURCE.find((file) => file.path.endsWith('shell/Page.tsx'))

    expect(page?.text).toContain('max-w-2xl')
    // And the page container itself has no cap at all.
    expect(page?.text.split('export function Page')[1]?.split('export function')[0]).not.toContain('max-w-')
  })
})

describe('every figure on every screen', () => {
  it('is set in the mono face, which is what makes a column of amounts read as one', () => {
    // `formatPaisa` is what puts a figure on a screen. Wherever one is shown, it is shown through `Figure`, which carries the face and the lining digits.
    const showingMoney = SOURCE.filter((file) => file.text.includes('formatPaisa(') && file.path.endsWith('.tsx'))

    expect(showingMoney.length).toBeGreaterThan(1)
    for (const file of showingMoney) {
      expect(file.text, `${file.path} shows a figure without the face that lines it up`).toMatch(/<Figure/)
    }
  })
})
