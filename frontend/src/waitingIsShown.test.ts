// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Nauman: "Use a skeleton and spinners for all of the loadings, for such UI use skeletons, for buttons submission use spinners".

// Written once here rather than remembered on each screen, for the same reason the pointer cursor is: a rule that has to be re-applied by hand is a rule the next screen forgets. Read relative to itself, because the commit gate runs this in a throwaway checkout that is not a git repository.
const SOURCE = dirname(new URL(import.meta.url).pathname)

function screenFiles(dir: string): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return screenFiles(path)
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : []
  })
}

/** A screen that waits on a reading and puts nothing in the shape of what is coming. */
export function waitsWithoutASkeleton(source: string): boolean {
  // Asked of anything that branches on `undefined`, not only of the file that does the reading: the screen holding the waiting UI is usually not the one that called `useQuery`. Requiring both left `People.tsx` and every component like it unswept.

  // A reading is always a bare local -- `stages === undefined`. `contract.actualAreaSqft === undefined` is a field that may be absent, which is a fact about a contract and not a screen waiting on anything.
  if (!/(?<![.\w])\w+\s*===\s*undefined/.test(source)) return false

  // Put on the screen, not merely imported: an import left behind by a screen that went back to saying a word satisfies a check for the word `WhileWaiting` and nothing else. Either the shape is here, or it is handed to a component named for the waiting it does -- `SitesListWaiting`, `Waiting`.
  return !/<([A-Z]\w*)?Waiting\b/.test(source)
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

describe('what a screen shows while it is waiting', () => {
  const screens = screenFiles(SOURCE).map((path) => ({
    path: path.split('/src/')[1],
    source: readFileSync(path, 'utf8'),
  }))

  it('is the shape of what is coming, on every screen that reads anything', () => {
    expect(screens.filter(({ source }) => waitsWithoutASkeleton(source)).map(({ path }) => path)).toEqual([])
  })

  it('is read over the screens it is actually asked of', () => {
    // The floor, counted the way the sweep counts. A sweep that stopped finding screens reports the same clean result as one that found them all correct, and a floor counting a wider set than the sweep does hides exactly that.
    expect(screens.filter(({ source }) => source.includes('=== undefined')).length).toBeGreaterThan(3)
  })

  it('would notice a screen that only said a word', () => {
    // The control, verbatim in the shape the app used to be written in.
    expect(
      waitsWithoutASkeleton('const s = useQuery(a, {})\nif (s === undefined) return <p>Getting your sites…</p>')
    ).toBe(true)
    expect(
      waitsWithoutASkeleton('const s = useQuery(a, {})\nif (s === undefined) return <WhileWaiting what="x" />')
    ).toBe(false)
    expect(waitsWithoutASkeleton('const s = useQuery(a, {})\nif (s === undefined) return <SitesListWaiting />')).toBe(
      false
    )
    // The one that got through: the screen went back to a word and left the import behind it.
    expect(
      waitsWithoutASkeleton(
        "import { WhileWaiting } from './Skeleton'\nconst s = useQuery(a, {})\nif (s === undefined) return <p>Looking…</p>"
      )
    ).toBe(true)
    // A screen that never asks whether an answer has arrived is not waiting on one.
    expect(waitsWithoutASkeleton('if (problem === null) return null')).toBe(false)
    // Nor is one asking whether a field is there. A contract that nobody has measured is a contract, not a read in flight.
    expect(waitsWithoutASkeleton('contract.actualAreaSqft === undefined ? none : some')).toBe(false)
    expect(waitsWithoutASkeleton('stage.billedOn === undefined ? "Not billed" : stage.billedOn')).toBe(false)
    // And the bare local it is really about is still caught.
    expect(waitsWithoutASkeleton('if (stages === undefined) return <p>Looking…</p>')).toBe(true)
  })
})

// The button that knows how is written out of plain elements, which is the point of it existing.
const WHERE_IT_IS_WRITTEN = 'components/form/Button.tsx'

describe('what a button does while it is sending', () => {
  const screens = screenFiles(SOURCE).map((path) => ({
    path: path.split('/src/')[1],
    source: readFileSync(path, 'utf8'),
  }))

  it('is written somewhere, so the one exception below is an exception to something', () => {
    // Without this, deleting Button.tsx leaves a sweep that passes because there is nothing left to sweep.
    const itself = screens.find(({ path }) => path === WHERE_IT_IS_WRITTEN)

    expect(itself?.source).toContain('export function Button')
  })

  it('is the one button that knows how, everywhere', () => {
    // `disabled` on a plain button is a button that sends: it is off while something is in flight, and it is off without a spinner and usually with a label that changes width as it is pressed.
    const raw = screens
      .filter(({ path }) => path !== WHERE_IT_IS_WRITTEN)
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
    // And the central one is the point, not an exception to be spelled out.
    expect(sendsWithoutTheSpinner('<Button onClick={add} busy={saving} disabled={saving}>')).toEqual([])
  })
})
