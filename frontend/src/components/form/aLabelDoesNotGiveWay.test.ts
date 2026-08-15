// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'

// Nauman opened the day sheet at desk width and `Rs` was broken over two lines beside the amount. A two-character label sat in a flex row next to an input asking for `w-full`, and flex took the space out of the label rather than out of the box.

// What this can see and what it cannot, said plainly: there is no layout here, so it reads the classes rather than the wrapping. A class is not a rendered pixel -- but the cause of that bug was in the classes, and this is where it can be caught before somebody opens the screen at the width that shows it.

/** A class list asking for the whole row. `max-w-full` is a different word and caps a width rather than demanding one, so the boundary in front matters. */
const ASKS_FOR_EVERYTHING = /className="[^"]*(?<![-\w])w-full\b[^"]*"/g

/** Whatever tag was opened last. Found by walking back to the nearest one rather than forward from the tag, because `[^>]*` between a tag and its `className` stops dead at the `>` in an arrow function -- which is why the first version of this matched nothing in any file written the way this app writes them. */
const A_TAG = /<([A-Za-z][\w.]*)/g

// `Picker` was in this list too, and it has not existed since #89. A dead name in one list had company in another, which is why both were checked rather than the one const measured.
const CONTROLS = ['input', 'textarea', 'select', 'Line', 'Lines', 'Pick', 'MoneyLine']

function whatOpenedLastBefore(source: string, at: number): string {
  const tags = [...source.slice(0, at).matchAll(A_TAG)]

  return tags.length === 0 ? '' : tags[tags.length - 1][1]
}

/** A row rather than a column: `flex-col` stacks, and a stacked label has nothing to give way to -- which is every `Field` in the app. */
function isARow(classes: string): boolean {
  return /\bflex\b/.test(classes) && !/\bflex-col\b/.test(classes)
}

/** Anything holding words rather than an answer. It is what gets squeezed, because in that row it is the only thing that can be. */
const A_LABEL = /<span\b[^>]*>/g

// Read from the control backwards rather than from the row forwards. A row read forwards has no end a regex can find, and a window guessed at swallows the next question down the screen -- which is how the first draft of this called three innocent rows guilty.

// Wide enough for a control written the way controls are really written. At 400 it passed the row that shipped: a dozen attributes on their own lines put the row's own tag out of reach, and the control test agreed because the string in it was one line long. The fixture was shorter than the thing it stood for.
const NEAR = 1500

/** Every place a control takes the whole row and a label beside it is free to give way. */
export function whatGivesWayIn(source: string): Array<string> {
  const found: Array<string> = []

  for (const asking of source.matchAll(ASKS_FOR_EVERYTHING)) {
    const opened = whatOpenedLastBefore(source, asking.index)
    if (!CONTROLS.includes(opened)) {
      continue
    }

    const before = source.slice(Math.max(0, asking.index - NEAR), asking.index)

    // The row it sits in, if it sits in one: the last flex tag opened before it.
    const rows = [...before.matchAll(/className="([^"]*)"/g)].filter((classes) => isARow(classes[1]))
    if (rows.length === 0) {
      continue
    }

    const beside = before.slice(rows[rows.length - 1].index)
    const squeezable = [...beside.matchAll(A_LABEL)].filter((label) => !label[0].includes('shrink-0'))
    if (squeezable.length > 0) {
      found.push(`<${opened}> asks for the whole row beside ${squeezable.length} label(s) free to give way`)
    }
  }

  return found
}

describe('a label beside a control that takes the rest', () => {
  const screens = everyScreen()

  it('never gives way, on any row in the app', () => {
    const giving = screens.flatMap(({ path, source }) => whatGivesWayIn(source).map((said) => `${path}: ${said}`))

    expect(giving).toEqual([])
  })

  it('is asked of the screens this app really lays out', () => {
    // The floor. A reader that stopped opening screens would report the same clean sweep as an app with nothing wrong in it.
    expect(screens.length).toBeGreaterThan(20)
    expect(screens.map(({ path }) => path)).toContain('components/daySheet/MoneyLine.tsx')
  })

  it('would notice the row that was shipped, written the way it was really written', () => {
    // Not a one-line version of it. The first draft of this passed a planted `MoneyLine` because a dozen attributes on their own lines put the row out of reach, while the control here was a single line and well inside it.
    const shipped = `      <div className="border-border focus-within:border-primary flex items-baseline gap-2 border-b-2 transition-colors">
        <span className="text-muted-foreground font-display text-2xl leading-none">Rs</span>
        <input
          value={value}
          onChange={(event) => onChange(groupWhileTyping(event.target.value))}
          aria-invalid={showing || undefined}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-label="How much"
          className="text-foreground placeholder:text-muted-foreground/40 font-display w-full min-w-0 border-0 bg-transparent py-1 text-[2.75rem] leading-tight outline-none"
        />
      </div>`

    expect(whatGivesWayIn(shipped)).toHaveLength(1)
  })

  it('leaves alone the two ways of writing a row that holds', () => {
    // Either the label refuses to shrink, or the control asks for what is left rather than for all of it. The row that shipped did neither.
    const refuses =
      '<div className="flex items-baseline gap-2"><span className="shrink-0">Rs</span><input className="w-full" /></div>'
    expect(whatGivesWayIn(refuses)).toEqual([])

    const asksForWhatIsLeft =
      '<div className="flex items-baseline gap-2"><span>Rs</span><input className="min-w-0 flex-1" /></div>'
    expect(whatGivesWayIn(asksForWhatIsLeft)).toEqual([])

    // A column is not a row: a stacked label has nothing to give way to, which is every `Field` in the app.
    expect(
      whatGivesWayIn('<label className="flex flex-col gap-1.5"><span>Name</span><input className="w-full" /></label>')
    ).toEqual([])
  })

  it('leaves alone the three it called guilty when it read rows forwards', () => {
    // All false, and all from guessing where a row ends. `max-w-full` caps a width rather than asking for one; a full-width refusal in a grid is not in a flex row at all; and a table inside a scrolling box is the width of its own box.
    expect(whatGivesWayIn('<Skeleton className="h-4 w-40 max-w-full" />')).toEqual([])
    expect(whatGivesWayIn('<span role="alert" className="text-destructive w-full text-sm">')).toEqual([])
    expect(whatGivesWayIn('<div className="overflow-x-auto"><table className="w-full min-w-[30rem]">')).toEqual([])
  })
})
