// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'
import { withoutComments } from '../../testing/source'

// `Field` draws a label pointing at an id and hands that id to whatever is inside it, through context. Four controls in a row never took it -- `Pick`, then `PickATrade`, `PickAnAccount` and `PickAPerson` through it, and then `Day`, which was written to look like `Pick` on purpose. Fifteen labels in the app did nothing when tapped, and on a phone the label is a bigger target than the control under it.

// Four for four says the shape invites it rather than that four people were careless: the id arrives silently, so forgetting it looks exactly like taking it. Nothing failed, because nothing asked.

// Asked here off the tree rather than off a list. A test that renders the four controls it knows about is a test that goes quiet for the fifth, and the fifth is the one this is for. `Field.test.tsx` holds the other half -- that the id really reaches a control a thumb can press.

/** How a control says it is taking what the field is asking. */
const READS_THE_ID = 'useWhatIsAsked'

/** The two that read it inside `Field` itself, so a screen writing one of them is already right. */
const ALREADY_READ_IT = ['Line', 'Lines']

/** Where the context is defined and read for those two, so the exception below is an exception to something that exists. */
const WHERE_IT_IS_HANDED_OVER = 'components/form/Field.tsx'

/** Each `<Field …>` block, from its opening tag to the `</Field>` that closes it. `Field` never nests inside `Field`, so the first close is the right one. */
export function fieldsIn(source: string): Array<string> {
  const blocks: Array<string> = []

  for (const found of withoutComments(source).matchAll(/<Field[\s>]/g)) {
    const at = found.index
    const closes = withoutComments(source).indexOf('</Field>', at)
    blocks.push(withoutComments(source).slice(at, closes === -1 ? source.length : closes))
  }

  return blocks
}

/** The components a file writes itself, which is where a wrapper puts the part that reads the id. */
export function writtenIn(source: string): Array<string> {
  return [...withoutComments(source).matchAll(/function\s+([A-Z]\w*)/g)].map(([, name]) => name)
}

/** What is wrong with one field, said the way somebody would say it, or nothing. */
export function whatIsWrongWithTheField(block: string, source: string): string | null {
  // A file that reads the id somewhere and puts one of its own components inside the field is doing it the way `Pick` and `Day` now do: the reading lives in the inner component, because the context only exists below `Field`.
  const itsOwn = source.includes(READS_THE_ID) ? writtenIn(source) : []
  const taking = [...ALREADY_READ_IT, ...itsOwn]

  if (taking.some((name) => new RegExp(`<${name}\\b`).test(block))) return null

  return 'holds nothing that reads the id its label points at, so tapping the label does nothing'
}

describe('the label a field draws', () => {
  const screens = everyScreen()

  it('points at something that takes it, in every field this app writes', () => {
    const dead = screens.flatMap(({ path, source }) =>
      fieldsIn(source)
        .filter((block) => whatIsWrongWithTheField(block, source) !== null)
        .map(
          (block) =>
            `${path}: <Field ${/label=(\{[^}]*\}|"[^"]*")/.exec(block)?.[1] ?? '?'}> ${String(whatIsWrongWithTheField(block, source))}`
        )
    )

    expect(dead).toEqual([])
  })

  it('is asked of the fields this app really draws', () => {
    // The floor, counted the way the sweep counts. A reader that stopped finding fields reports the same clean result as an app where every label is live.
    const fields = screens.flatMap(({ path, source }) => fieldsIn(source).map(() => path))

    expect(fields.length).toBeGreaterThan(20)
    expect(fields).toContain('components/form/Pick.tsx')
    expect(fields).toContain('components/form/Day.tsx')
  })

  it('is handed over from somewhere, so the two that already read it are reading something', () => {
    // `Line` and `Lines` are excused above by name. If the context they read stops existing, that excuse becomes a hole the size of every field in the app.
    const where = screens.find(({ path }) => path === WHERE_IT_IS_HANDED_OVER)

    expect(where, `${WHERE_IT_IS_HANDED_OVER} is where the id is handed over and is not a file any more`).toBeDefined()
    expect(where?.source).toContain(`export function ${READS_THE_ID}`)
    expect(where?.source).toContain('htmlFor')
  })

  it('would notice a control that quietly does not take it', () => {
    // Verbatim in the shape `Pick` had for ten call sites and `Day` copied: a wrapper drawing its own field round something that never reads the id.
    const asPickWas = `
      export function Pick({ label }) {
        return (
          <Field label={label}>
            <ComboboxInput aria-label={label} />
          </Field>
        )
      }
    `

    expect(whatIsWrongWithTheField(fieldsIn(asPickWas)[0], asPickWas)).toContain('tapping the label does nothing')
  })

  it('leaves alone the ones that do take it', () => {
    const withALine = '<Field label="Name"><Line value={x} onChange={y} /></Field>'
    expect(whatIsWrongWithTheField(fieldsIn(withALine)[0], withALine)).toBeNull()

    const withLines = '<Field label="Note"><Lines value={x} /></Field>'
    expect(whatIsWrongWithTheField(fieldsIn(withLines)[0], withLines)).toBeNull()

    // And the shape the fix has: an inner component in the same file, which is the only place the context can be read from.
    const asPickIs = `
      function TheBox({ label }) {
        const asked = useWhatIsAsked()
        return <ComboboxInput id={asked.id} aria-label={label} />
      }
      export function Pick({ label }) {
        return (
          <Field label={label}>
            <TheBox label={label} />
          </Field>
        )
      }
    `

    expect(whatIsWrongWithTheField(fieldsIn(asPickIs)[0], asPickIs)).toBeNull()
  })

  it('is not satisfied by a file that merely mentions the hook', () => {
    // The excuse is "this file reads the id *and* puts its own component inside the field". A file that imports the hook and then draws somebody else's control is the original defect wearing an import.
    const onlyImported = `
      import { useWhatIsAsked } from './Field'
      export function Pick({ label }) {
        return (
          <Field label={label}>
            <ComboboxInput aria-label={label} />
          </Field>
        )
      }
    `

    expect(whatIsWrongWithTheField(fieldsIn(onlyImported)[0], onlyImported)).toContain('tapping the label does nothing')
  })

  it('reads the code and not what is written about it', () => {
    const said = '<Field label="Name">{/* it used to hold a <Line /> and did not read the id */}<Combobox /></Field>'

    expect(whatIsWrongWithTheField(fieldsIn(said)[0], said)).toContain('tapping the label does nothing')
  })
})
