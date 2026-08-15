// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { withoutComments } from '../../testing/source'

// Nauman twice: a `<select>` rendering in the OS blue, and a `<datalist>` popup in Chrome's mauve sitting over the error text. "Not acceptable."

// Both are the same thing: a control the browser draws, in its own colours, at its own size, in a position we do not set. No CSS we write reaches either of them. So neither is allowed here, and the next person reaching for `<select>` because it is one tag finds this instead of finding out from him.

/** Every tag whose popup the browser draws rather than the app. */
const DRAWN_BY_THE_BROWSER = ['select', 'datalist']

// shadcn's own, copied in by their CLI. What they use inside themselves is theirs; what this repository writes is what this is about. Said as a path relative to `src`, which is how `everyScreen` names them; the sweep it replaced named them absolutely, and a leading slash left here would have quietly stopped filtering anything.
const THEIRS = 'components/ui/'

/** Every place a screen opens a control the browser will draw. */
export function drawnByTheBrowserIn(written: string): Array<string> {
  // The code, not the prose about it. Both files that replaced a `<select>` explain in a comment what a `<select>` did wrong, and reading that as a `<select>` is the same defect a second guard already had.
  const source = withoutComments(written)

  return DRAWN_BY_THE_BROWSER.filter((tag) => new RegExp(`<${tag}[\\s>]`).test(source))
}

describe('a control the browser draws', () => {
  const screens = everyScreen().filter(({ path }) => !path.startsWith(THEIRS))

  it('is on none of our screens', () => {
    const drawn = screens.flatMap(({ path, source }) =>
      drawnByTheBrowserIn(source).map((tag) => `${path}: <${tag}> is drawn by the browser, not by us`)
    )

    expect(drawn).toEqual([])
  })

  it('is asked of the screens this app really has', () => {
    // The floor. A reader that stopped opening screens would report the same clean sweep as an app with none of them left.
    expect(screens.length).toBeGreaterThan(30)
    expect(screens.map(({ path }) => path)).toContain('components/daySheet/WhoWasPaid.tsx')
  })

  it('would notice either of the two he was sent', () => {
    // Verbatim in the shape each of them had.
    expect(drawnByTheBrowserIn('<select value={stage} onChange={onChange}>')).toEqual(['select'])
    expect(drawnByTheBrowserIn('<datalist id={list}><option value="A mason" /></datalist>')).toEqual(['datalist'])
  })

  it('reads the code and not what is written about it', () => {
    // Both replacements say in a comment what the tag they replaced did wrong. A guard that reads that as the tag teaches people to stop saying it.
    expect(drawnByTheBrowserIn('// it was a <select> and the browser drew it\nconst x = 1')).toEqual([])
    expect(drawnByTheBrowserIn('/* a <datalist> popup in Chrome mauve */\nconst y = 2')).toEqual([])
    // And the code under the comment is still read.
    expect(drawnByTheBrowserIn('// no more <select>\n<select value={x}>')).toEqual(['select'])
  })

  it('leaves alone the words that only look like them', () => {
    // `selected`, `selectable` and a comment about a datalist are not controls.
    expect(drawnByTheBrowserIn('const selected = people.find(one)')).toEqual([])
    expect(drawnByTheBrowserIn('<Selector value={x} />')).toEqual([])
    expect(drawnByTheBrowserIn('<ComboboxItem value={choice}>')).toEqual([])
  })

  it('leaves shadcn their own', () => {
    // Their combobox is built on Base UI and uses whatever it uses. The rule is about what this repository writes, and holding somebody else's component to it is how you come to maintain a fork of it.
    expect(screens.map(({ path }) => path).filter((path) => path.includes('components/ui/'))).toEqual([])
  })
})
