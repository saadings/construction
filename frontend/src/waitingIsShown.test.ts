// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'

// Nauman: "Use a skeleton and spinners for all of the loadings, for such UI use skeletons, for buttons submission use spinners".

// Written once here rather than remembered on each screen, for the same reason the pointer cursor is: a rule that has to be re-applied by hand is a rule the next screen forgets.

/** Where each `*Waiting` component is written, so a screen handing its waiting to one can be followed to what that one actually puts on the screen. */
export function whereWaitingIsWritten(files: Array<{ source: string }>): Map<string, Array<string>> {
  const written = new Map<string, Array<string>>()

  for (const { source } of files) {
    for (const [, name] of source.matchAll(/function\s+(\w*Waiting)\b/g)) {
      written.set(name, [...(written.get(name) ?? []), source])
    }
  }

  return written
}

/** A screen that waits on a reading and puts nothing in the shape of what is coming. */
export function waitsWithoutASkeleton(source: string, written: Map<string, Array<string>> = new Map()): boolean {
  // Asked of anything that branches on `undefined`, not only of the file that does the reading: the screen holding the waiting UI is usually not the one that called `useQuery`. Requiring both left `People.tsx` and every component like it unswept.

  // A reading is always a bare local -- `stages === undefined`. `contract.actualAreaSqft === undefined` is a field that may be absent, which is a fact about a contract and not a screen waiting on anything.

  // And one answered by throwing is not a screen waiting either: it is a click handler refusing, where there is nothing on the screen to hold a shape. A screen that waits returns something to look at.

  // Nor is a row picked out of a list somebody already has. `const already = people.find(...)` asks whether a name is among them, which is a fact about the list rather than a read in flight.
  const searched = new Set(
    [...source.matchAll(/\b(?:const|let)\s+(\w+)\s*=[^\n]*\.find\s*\(/g)].map((found) => found[1])
  )

  const waits = [...source.matchAll(/(?<![.\w])(\w+)\s*===\s*undefined/g)]
    .filter((found) => !searched.has(found[1]))
    .some((found) => !/^\s*\)?\s*\{?\s*throw\b/.test(source.slice(found.index + found[0].length)))

  if (!waits) return false

  // The grey bars themselves, and nothing that merely mentions them. This asked whether the name `Waiting` appeared in the file at all, and passed a screen that names its waiting component and then renders a word inside it -- a definition with no use, one turn on from the import with no definition it already caught.
  if (source.includes('<Skeleton')) return false

  // Handed to a component named for the waiting it does. `WhileWaiting` is only a labelled region, so it is not evidence of anything; one written in this same file is not either, because then this file is the one that would be holding the shape.
  const handedTo = [...source.matchAll(/<(\w*Waiting)\b/g)]
    .map(([, name]) => name)
    .filter((name) => name !== 'WhileWaiting' && !new RegExp(`function\\s+${name}\\b`).test(source))

  return !handedTo.some((name) => (written.get(name) ?? []).some((where) => where.includes('<Skeleton')))
}

/** Every plain `<button>` that turns itself off, which is a button that sends something and is not the one that knows how. */
export function sendsWithoutTheSpinner(source: string): Array<string> {
  return source
    .split('<button')
    .slice(1)
    .map((after) => after.slice(0, after.indexOf('>')))
    .filter((attributes) => attributes.includes('disabled='))
    .map((attributes) => attributes.replace(/\s+/g, ' ').trim().slice(0, 60))
}

// A bare local compared to `undefined` is the shape of a reading, and it is also the shape of an optional prop. The sweep cannot tell them apart, so the ones that are not readings are named here with the reason -- the same way a function that is deliberately global is named rather than quietly skipped.
const NOT_WAITING_ON_ANYTHING: Record<string, string> = {
  'components/form/Pick.tsx':
    'onUseANewName === undefined asks whether the kind being picked needs more than a name before it can be added, which is a question about a prop; this control reads nothing at all',
  'components/form/PickAnAccount.tsx':
    'onAdd === undefined asks whether the screen using it can add an account yet, which is a question about a prop -- a list still arriving cannot say whether the account is already on it',
  'components/site/ExtraWork.tsx':
    'onTakeOff === undefined asks whether the caller passed a way to take a line off, which is a question about a prop; every figure on this screen is handed to it already read',
  'components/shell/Panel.tsx':
    'count === undefined asks whether a heading was given a number to show beside it, which is a question about a prop; these are the shapes the app is drawn out of and none of them reads anything',
  'components/shell/Page.tsx':
    'said === undefined asks whether a screen handed over the sentence that goes under its title, which is a question about a prop; this is the box every screen sits in and it reads nothing',
  'components/shell/TheNav.tsx':
    'footer === undefined asks whether the caller handed over a sign-out to draw, which is a question about a prop -- the rail is given one and the sheet is not, since the account sits in the corner of the header on a phone',
  'components/form/Day.tsx':
    'date, said and picked === undefined each ask whether a string is a day on the calendar or whether the calendar handed one back; all three are worked out in this file and none of them is an answer in flight',
}

describe('what a screen shows while it is waiting', () => {
  const screens = everyScreen()

  it('is the shape of what is coming, on every screen that reads anything', () => {
    const written = whereWaitingIsWritten(screens)

    expect(
      screens
        .filter(({ path, source }) => !(path in NOT_WAITING_ON_ANYTHING) && waitsWithoutASkeleton(source, written))
        .map(({ path }) => path)
    ).toEqual([])
  })

  it('has nothing named as not waiting that is not there any more, or does not ask', () => {
    // An exemption outlives what it was written for, and a stale one silently excuses whatever takes that path next.
    for (const path of Object.keys(NOT_WAITING_ON_ANYTHING)) {
      const named = screens.find((screen) => screen.path === path)

      expect(named, `${path} is named as not waiting and is not a screen any more`).toBeDefined()
      expect(named?.source, `${path} no longer asks about undefined, so the line naming it can go`).toMatch(
        /(?<![.\w])\w+\s*===\s*undefined/
      )
    }
  })

  it('is read over the screens it is actually asked of', () => {
    // The floor, counted the way the sweep counts. A sweep that stopped finding screens reports the same clean result as one that found them all correct, and a floor counting a wider set than the sweep does hides exactly that.
    expect(screens.filter(({ source }) => source.includes('=== undefined')).length).toBeGreaterThan(3)
  })

  it('would notice a screen that only said a word', () => {
    // The control, verbatim in the shape the app used to be written in.
    const reads = 'const s = useQuery(a, {})\n'
    expect(waitsWithoutASkeleton(`${reads}if (s === undefined) return <p>Getting your sites…</p>`)).toBe(true)
    expect(waitsWithoutASkeleton(`${reads}if (s === undefined) return <Skeleton className="h-4" />`)).toBe(false)

    // The one that got through first: the screen went back to a word and left the import behind it.
    expect(
      waitsWithoutASkeleton(
        `import { WhileWaiting } from './Skeleton'\n${reads}if (s === undefined) return <p>Looking…</p>`
      )
    ).toBe(true)

    // A labelled region is not a shape: `<WhileWaiting>` around a word says "this is the waiting part" and shows nothing.
    expect(
      waitsWithoutASkeleton(`${reads}if (s === undefined) return <WhileWaiting what="x">Looking…</WhileWaiting>`)
    ).toBe(true)

    // A screen that never asks whether an answer has arrived is not waiting on one.
    expect(waitsWithoutASkeleton('if (problem === null) return null')).toBe(false)
    // Nor is a click handler refusing. There is nothing on the screen at that moment to hold a shape, and a screen that waits returns something to look at.
    expect(waitsWithoutASkeleton('if (trades === undefined) { throw new ConvexError("still coming") }')).toBe(false)
    // But the same reading answered with something to look at is exactly what this is about.
    expect(waitsWithoutASkeleton('if (trades === undefined) { return <p>Looking…</p> }')).toBe(true)
    // Nor is one asking whether a field is there. A contract that nobody has measured is a contract, not a read in flight.
    expect(waitsWithoutASkeleton('contract.actualAreaSqft === undefined ? none : some')).toBe(false)
    expect(waitsWithoutASkeleton('stage.billedOn === undefined ? "Not billed" : stage.billedOn')).toBe(false)
  })

  it('follows a screen that hands its waiting to somebody else, and reads what that one shows', () => {
    // The second hole, one turn on from the first: that control catches an import with no definition, and this is a definition with no use. A screen naming `SitesListWaiting` passed while the component it named rendered a word.
    const reads = 'const s = useQuery(a, {})\nif (s === undefined) return <SitesListWaiting />'

    const holdsTheShape = new Map([['SitesListWaiting', ['function SitesListWaiting() { return <Skeleton /> }']]])
    expect(waitsWithoutASkeleton(reads, holdsTheShape)).toBe(false)

    const saysAWord = new Map([['SitesListWaiting', ['function SitesListWaiting() { return <p>Looking…</p> }']]])
    expect(waitsWithoutASkeleton(reads, saysAWord)).toBe(true)

    // One written in the same file is not evidence about that file, or a screen would vouch for itself by naming a function.
    const itsOwn =
      'const s = useQuery(a, {})\nif (s === undefined) return <Waiting />\nfunction Waiting() { return <p>Looking…</p> }'
    expect(waitsWithoutASkeleton(itsOwn, new Map([['Waiting', ['function Waiting() { return <Skeleton /> }']]]))).toBe(
      true
    )
  })

  it('names the screen when a component it leans on stops showing anything', () => {
    // Against the real tree rather than a string: gut `SitesListWaiting` where it is written, and the screen leaning on it has to come back by name.
    const gutted = screens.map(({ path, source }) =>
      path === 'components/sites/SitesList.tsx'
        ? { path, source: source.replaceAll('<Skeleton', '<p') }
        : { path, source }
    )
    const written = whereWaitingIsWritten(gutted)

    expect(gutted.filter(({ source }) => waitsWithoutASkeleton(source, written)).map(({ path }) => path)).toContain(
      'routes/index.tsx'
    )
  })
})

// The two controls that know how are written out of plain elements, which is the point of them existing. `Button` is what sends a form; `WayOut` is what removes a row it sits beside, and it turns itself off for a sharper reason -- a second press on a way out lands on whatever row took the first one's place.
const WHERE_THEY_ARE_WRITTEN = ['components/form/Button.tsx', 'components/form/WayOut.tsx']

describe('what a button does while it is sending', () => {
  const screens = everyScreen()

  it('is written somewhere, so the exceptions below are exceptions to something', () => {
    // Without this, deleting either of them leaves a sweep that passes because there is nothing left to sweep.
    for (const [path, written] of [
      ['components/form/Button.tsx', 'export function Button'],
      ['components/form/WayOut.tsx', 'export function WayOut'],
    ]) {
      const itself = screens.find((screen) => screen.path === path)

      expect(itself?.source, `${path} is named as one of the two and is not there`).toContain(written)
    }
  })

  it('is the one button that knows how, everywhere', () => {
    // `disabled` on a plain button is a button that sends: it is off while something is in flight, and it is off without a spinner and usually with a label that changes width as it is pressed.
    const raw = screens
      .filter(({ path }) => !WHERE_THEY_ARE_WRITTEN.includes(path))
      .flatMap(({ path, source }) =>
        sendsWithoutTheSpinner(source).map((attributes) => `${path}: <button ${attributes}`)
      )

    expect(raw).toEqual([])
  })

  it('would notice one written out by hand again', () => {
    // The control, verbatim from what these five screens each used to say.
    expect(sendsWithoutTheSpinner('<button type="button" onClick={add} disabled={saving}>')).toHaveLength(1)
    // A plain button that sends nothing is left alone: "Take off the list" and "Never mind" are not in flight and never turn off.
    expect(sendsWithoutTheSpinner('<button type="button" onClick={() => setOpen(true)}>')).toEqual([])
    // And the two central ones are the point, not exceptions to be spelled out.
    expect(sendsWithoutTheSpinner('<Button onClick={add} busy={saving} disabled={saving}>')).toEqual([])
    expect(sendsWithoutTheSpinner('<WayOut onClick={takeBack} busy={saving}>')).toEqual([])
  })
})
