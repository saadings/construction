// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { inputTypesWrittenIn, tagsWrittenIn } from '../../testing/tags'

// Nauman twice: a `<select>` rendering in the OS blue, and a `<datalist>` popup in Chrome's mauve sitting over the error text. "Not acceptable."

// Both are the same thing: a control the browser draws, in its own colours, at its own size, in a position we do not set. No CSS we write reaches either of them. So neither is allowed here, and the next person reaching for `<select>` because it is one tag finds this instead of finding out from him.

// A third time, and it was this guard's fault. He sent a screenshot of a grey OS date field with a calendar glyph we do not control, and asked why the app is not shadcn throughout when he had said it should be. Eleven `type="date"` across eight screens, and this file passed every one of them.

// The rule was written correctly in the comment above and implemented as a list of the two elements he had complained about. Every word of "a control the browser draws, in its own colours, at its own size, in a position we do not set" applies to a date input. **The guard froze his two examples instead of his rule**, which is the failure it existed to prevent.

/** Every tag whose popup the browser draws rather than the app. */
const DRAWN_BY_THE_BROWSER = ['select', 'datalist']

// The same property, asked of `<input>` by its type. Not a longer list of things he has complained about: every one of these makes a browser draw a picker, a spinner or a file chooser of its own, in its own colours, that no CSS here reaches.

// `checkbox` and `radio` are in it although nothing uses them today, because the point is to catch the next one rather than to describe this afternoon. What the app does use is `<button role="radio">`, which is ours and drawn by us.
const DRAWN_BY_THE_BROWSER_TOO = [
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'color',
  'file',
  'range',
  'number',
  'checkbox',
  'radio',
]

// shadcn's own, copied in by their CLI. What they use inside themselves is theirs; what this repository writes is what this is about. Said as a path relative to `src`, which is how `everyScreen` names them; the sweep it replaced named them absolutely, and a leading slash left here would have quietly stopped filtering anything.
const THEIRS = 'components/ui/'

// The four screens that still carry a date input, listed by name and not by a count, because a count is satisfied by any four. They are in const-2's picker work and converting them from here would collide; they come out of this list as that lands.

// Listed rather than skipped, so a ninth screen reaching for a browser-drawn control fails here on the day it is written rather than passing over a gap somebody already knew about.
const STILL_TO_CONVERT = [
  'components/daySheet/DaySheet.tsx',
  'components/moneyIn/ComingIn.tsx',
  'components/shares/PayOut.tsx',
  'components/site/WhoIsOnThisHouse.tsx',
]

/** Every place a screen opens a control the browser will draw. */
export function drawnByTheBrowserIn(written: string): Array<string> {
  return [...tagsWrittenIn(written, DRAWN_BY_THE_BROWSER), ...inputTypesWrittenIn(written, DRAWN_BY_THE_BROWSER_TOO)]
}

describe('a control the browser draws', () => {
  const screens = everyScreen().filter(({ path }) => !path.startsWith(THEIRS))

  it('is on none of our screens, but the four still waiting on the picker work', () => {
    const drawn = screens
      .filter(({ path }) => !STILL_TO_CONVERT.includes(path))
      .flatMap(({ path, source }) =>
        drawnByTheBrowserIn(source).map((what) => `${path}: ${what} is drawn by the browser, not by us`)
      )

    expect(drawn).toEqual([])
  })

  it('still names the four, so the exemption cannot outlive them', () => {
    // The other end. An exemption that stops being true reads exactly like an exemption that is still needed, and this is the assertion that tells them apart: each of these must still have something to convert.
    for (const path of STILL_TO_CONVERT) {
      const screen = screens.find((one) => one.path === path)

      expect(screen, `${path} is exempted and is not a screen this app has`).toBeDefined()
      expect(
        drawnByTheBrowserIn(screen?.source ?? ''),
        `${path} is exempted and has nothing left to convert`
      ).not.toEqual([])
    }
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

  it('would notice the third, which it was written for and missed', () => {
    // As it is actually written on a screen: not `<input>`, but the app's own box with the attribute on it, which hands it to an input two files away.
    expect(drawnByTheBrowserIn('<Line value={day} onChange={change} type="date" aria-label="Which day" />')).toEqual([
      'date',
    ])
    expect(drawnByTheBrowserIn("<input type='file' onChange={read} />")).toEqual(['file'])
  })

  it('notices each of them separately, rather than one standing in for the rest', () => {
    // Named one at a time, because a list is satisfied by whichever member somebody happens to test.

    // And written out here rather than iterated off `DRAWN_BY_THE_BROWSER_TOO`, which is the whole of what makes it an assertion. A loop over the list stops asking about whatever is quietly taken out of the list, and reports exactly what a run with every one of them still in it reports -- the same fusing that let a count guard pass while the thing it counted was deleted underneath it.
    for (const type of [
      'date',
      'datetime-local',
      'time',
      'month',
      'week',
      'color',
      'file',
      'range',
      'number',
      'checkbox',
      'radio',
    ]) {
      expect(drawnByTheBrowserIn(`<Line type="${type}" />`), `${type} is not caught`).toEqual([type])
    }
  })

  it('leaves alone the types we draw ourselves', () => {
    // The boundary, and the half that gets left out. Every one of these is a box or a button this app styles, and a guard that caught them would forbid the fix as well as the defect.
    for (const type of ['text', 'email', 'password', 'tel', 'url', 'search', 'button', 'submit', 'reset', 'hidden']) {
      expect(drawnByTheBrowserIn(`<Line type="${type}" />`), `${type} is ours and is being flagged`).toEqual([])
    }

    // What the app really uses for a choice: our own button, wearing the role rather than the type.
    expect(drawnByTheBrowserIn('<button type="button" role="radio" aria-checked={chosen}>')).toEqual([])
  })

  it('reads the code and not what is written about it', () => {
    // Both replacements say in a comment what the tag they replaced did wrong. A guard that reads that as the tag teaches people to stop saying it.
    expect(drawnByTheBrowserIn('// it was a <select> and the browser drew it\nconst x = 1')).toEqual([])
    expect(drawnByTheBrowserIn('/* a <datalist> popup in Chrome mauve */\nconst y = 2')).toEqual([])
    expect(drawnByTheBrowserIn('// it used to be type="date" and the OS drew it\nconst z = 3')).toEqual([])
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
