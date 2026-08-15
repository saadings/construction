// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'

// `Field` renders a `<label>`, and a label points at one control: the first labelable thing inside it takes the label's words as its own name. So a row of choices inside a `Field` announces its first choice as the field's own label -- "Ours to sell" read out as "Whose house", "Cheque" read out as "How paid How paid".

// Found in four places by four different accidents, and `Choices` exists to fix it. Nothing obliged anybody to use it, which is a rule living in a comment.

/** Everything a `<label>` would try to name, which is every element a person can put an answer into. */
const A_CONTROL = /<(Line|Lines|Picker|MoneyLine|input|select|textarea|button)\b/g

/** Each `<Field …>` block, from its opening tag to the `</Field>` that closes it. `Field` never nests inside `Field`, so the first close is the right one. */
export function fieldsIn(source: string): Array<string> {
  const blocks: Array<string> = []

  // Matched with what follows the name, so a component whose name merely begins with `Field` is not swept up as one.
  for (const found of source.matchAll(/<Field[\s>]/g)) {
    const at = found.index
    const closes = source.indexOf('</Field>', at)
    blocks.push(source.slice(at, closes === -1 ? source.length : closes))
  }

  return blocks
}

/** What is wrong with one `Field`, in the words of what a person would hear, or nothing. */
export function whatIsWrongWithTheField(block: string): string | null {
  // A group of choices is the case this was found in four times. The first of them takes the field's label as its name and cannot be found -- by a test or by anybody listening -- by what is written on it.
  if (/role="(radio|checkbox|switch)"/.test(block) || /type="(radio|checkbox)"/.test(block)) {
    return 'a row of choices inside a Field, where the first one takes the label as its own name: use Choices'
  }

  // A label inside a label names nothing predictable, and the inner one is usually a control that brought its own.
  if (/<label\b/.test(block)) {
    return 'a label inside a Field, which is a label inside a label'
  }

  const controls = block.match(A_CONTROL) ?? []
  if (controls.length > 1) {
    return `${controls.length} controls inside one Field (${controls.join(' ')}), and a label names only the first`
  }

  return null
}

describe('what one Field is allowed to hold', () => {
  const screens = everyScreen()

  const fields = screens.flatMap(({ path, source }) => fieldsIn(source).map((block) => ({ path, block })))

  it('is one control, everywhere a screen asks a question', () => {
    const wrong = fields
      .map(({ path, block }) => ({ path, said: whatIsWrongWithTheField(block) }))
      .filter(({ said }) => said !== null)
      .map(({ path, said }) => `${path}: ${said}`)

    expect(wrong).toEqual([])
  })

  it('is asked of the questions this app really asks', () => {
    // The floor. A reader that stopped finding `Field` would report the same clean sweep as a tree with nothing wrong in it.
    expect(fields.length).toBeGreaterThan(20)
    // Anchored on a control that exists today rather than on one that has been replaced: `Picker` was a `<select>` and is gone, which is exactly the kind of anchor that rots into a floor about nothing.
    expect(fields.some((field) => field.block.includes('<Line'))).toBe(true)
  })

  it('is read over the screens that already do it the right way', () => {
    // The other half of the floor, counted the way the sweep counts: these hold rows of choices today and hold them outside a `Field`. A sweep that stopped opening screens loses these first.
    const usingChoices = screens.filter(({ source }) => source.includes('<Choices')).map(({ path }) => path)

    expect(usingChoices).toContain('components/sites/HouseDetails.tsx')
    expect(usingChoices).toContain('components/daySheet/DaySheet.tsx')
    expect(usingChoices.length).toBeGreaterThan(3)
  })

  it('would notice the four it was written for', () => {
    // Verbatim in the shape each of them had. "Whose house" is the one that was read out in place of "Ours to sell".
    expect(
      whatIsWrongWithTheField('<Field label="Whose house"><div role="radiogroup"><button role="radio">Ours to sell')
    ).toContain('use Choices')
    expect(whatIsWrongWithTheField('<Field label="How paid"><input type="radio" value="cheque" />')).toContain(
      'use Choices'
    )
  })

  it('would notice two answers asked under one label', () => {
    // Not the same defect, the same cause: the label names the first and the second is left with nothing.
    expect(
      whatIsWrongWithTheField('<Field label="Name"><Line value={first} /><Line value={second} /></Field>')
    ).toContain('2 controls')
    expect(whatIsWrongWithTheField('<Field label="Number"><Line value={one} /><label>and</label>')).toContain(
      'a label inside a label'
    )
  })

  it('leaves a question with one answer in it alone', () => {
    expect(
      whatIsWrongWithTheField('<Field label="Name" problem={x}><Line value={name} aria-label="Name" /></Field>')
    ).toBeNull()
    expect(
      whatIsWrongWithTheField('<Field label="Where it has got to"><Picker value={stage}><option /></Picker>')
    ).toBeNull()
    // And a row of choices outside a `Field` is the fix, so the sweep does not pick it up at all.
    expect(fieldsIn('<Choices label="Whose house"><button role="radio">Ours to sell</button></Choices>')).toEqual([])
    // Nor does a component whose name only begins the same way.
    expect(fieldsIn('<Fieldwork value={x} />')).toEqual([])
  })
})
