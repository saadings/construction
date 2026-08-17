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

  /** The box a screen sits in: the first element `Page` opens, and the only thing in that file this rule is about. */
  const THE_CONTAINER = /export function Page\([\s\S]*?<div className="([^"]*)"/

  it('caps a form inside the content rather than capping the page around it', () => {
    // A form reads badly at 1440px: the eye loses the line between a label and the box it belongs to. A table does not, so the cap belongs to the form.
    const page = SOURCE.find((file) => file.path.endsWith('shell/Page.tsx'))

    expect(page?.text).toContain('max-w-2xl')

    // Asked of the container rather than of everything written inside `Page`. Read whole, the function body now holds the sentence that goes under a title, capped at the width prose is read at -- and a cap on a paragraph is not the page capping itself, which is the distinction the rule two blocks up already makes.
    const container = THE_CONTAINER.exec(page?.text ?? '')

    expect(container, 'Page no longer opens with a container this can read').not.toBeNull()
    expect(container?.[1], 'this is not the container, so what it says about caps is about something else').toContain(
      'px-5'
    )
    expect(container?.[1]).not.toContain('max-w-')
  })

  it('would notice the cap going back on the container tomorrow', () => {
    // The control, on the reader rather than on the file: this narrowed from the whole function body to one element, and a regex that matched the wrong element -- or nothing -- would agree with a clean `Page` forever.
    expect(
      THE_CONTAINER.exec('export function Page({ title }) {\n  return <div className="mx-auto max-w-lg px-5">')?.[1]
    ).toBe('mx-auto max-w-lg px-5')
    expect(THE_CONTAINER.exec('export function Page({ title }) {\n  return <p className="max-w-[64ch]">')).toBeNull()
  })
})

describe('room left for something else on the screen', () => {
  // The bar along the bottom went with the shell, and `--phone-bar` has now gone with its last reader. What does not go is the rule the variable existed to keep.

  it("is never a flat guess at another element's height", () => {
    // `bottom-20` was 15px behind the bar on an iPhone, because a guess cannot know about the home indicator's inset. Anything clearing something else reads that thing rather than estimating it.
    const guessing = SOURCE.filter((file) => /(bottom|pb)-\[?(20|24|16)\b/.test(file.text)).map((file) => file.path)

    expect(guessing).toEqual([])
  })

  it('leaves nothing reading a variable that is no longer written', () => {
    // Both ends, and the order they have to hold in: a `var()` whose name nobody defines makes the whole `bottom` declaration invalid, and the footer that was stuck to the screen quietly scrolls away with the page. Nothing throws and nothing logs -- it is a thing you can only see by looking.
    const styles = readFileSync('frontend/src/styles.css', 'utf8')

    expect(styles).not.toContain('--phone-bar')
    expect(SOURCE.filter((file) => file.text.includes('--phone-bar')).map((file) => file.path)).toEqual([])
  })

  it('is looking at the screens, rather than at an empty list', () => {
    // The floor: a sweep that stopped finding files reports the same clean answer as a tree with nothing wrong in it.
    expect(SOURCE.length).toBeGreaterThan(20)
    expect(SOURCE.map((file) => file.path)).toContain('frontend/src/components/daySheet/DaySheet.tsx')
  })

  it('reads the stylesheet it is judging, rather than an empty string', () => {
    // The other end of the check above: `readFileSync` on a moved file would throw, but a stylesheet emptied or renamed to something this cannot see would pass the `not.toContain` perfectly.
    const styles = readFileSync('frontend/src/styles.css', 'utf8')

    expect(styles).toContain('--background:')
    expect(styles.length).toBeGreaterThan(500)
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
