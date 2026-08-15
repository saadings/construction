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

  // Reading one value would let `max-w-md` through, so this reads the shape instead: a column centred in the page and capped at a phone. A cap on a paragraph or on a control is not that, and is left alone.
  const A_PAGE_WIDE_COLUMN = /mx-auto[^"']*max-w-(xs|sm|md|lg)\b|max-w-(xs|sm|md|lg)[^"']*mx-auto/

  /** Centred and capped on purpose. Both are screens with no nav, one thing to do, and nothing to line up. */
  const CENTRED_ON_PURPOSE: Record<string, string> = {
    'frontend/src/components/NotFound.tsx': 'a page that is not there, which is a sentence and a way back',
    'frontend/src/components/shell/WayIn.tsx': 'the signed-out screen, which is a name and one button',
  }

  it('is not a phone-wide column on any screen but the two that are meant to be', () => {
    const centred = SOURCE.filter((file) => A_PAGE_WIDE_COLUMN.test(file.text)).map((file) => file.path)

    expect(centred.sort()).toEqual(Object.keys(CENTRED_ON_PURPOSE).sort())
  })

  it('would notice a screen that centred itself in a column tomorrow', () => {
    // The control, on the matcher rather than on the list: a regex matching nothing would otherwise pass for a clean tree.
    expect(A_PAGE_WIDE_COLUMN.test('className="mx-auto flex max-w-lg flex-col gap-7"')).toBe(true)
    expect(A_PAGE_WIDE_COLUMN.test('className="w-full max-w-md"')).toBe(false)
    expect(A_PAGE_WIDE_COLUMN.test('className="text-muted-foreground max-w-xs"')).toBe(false)
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

describe('the room the bar along the bottom of a phone takes', () => {
  it('is written once, and read by everything sitting above it', () => {
    // A flat guess at another element's height drifts the moment that element gains a row -- and it was already 15px wrong on an iPhone, where the bar carries the home indicator's inset as well.
    const styles = readFileSync('frontend/src/styles.css', 'utf8')

    expect(styles).toContain('--phone-bar:')
    expect(styles).toMatch(/--phone-bar:[^;]*env\(safe-area-inset-bottom\)/)

    const guessing = SOURCE.filter((file) => /(bottom|pb)-\[?(20|24|16)\b/.test(file.text)).map((file) => file.path)
    expect(guessing).toEqual([])
  })

  it('is read by the screens that sit above it, rather than by nobody', () => {
    // The control: the check above passes just as well against screens that clear nothing at all.
    const reading = SOURCE.filter((file) => file.text.includes('var(--phone-bar)')).map((file) => file.path)

    expect(reading.length).toBeGreaterThanOrEqual(3)
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
