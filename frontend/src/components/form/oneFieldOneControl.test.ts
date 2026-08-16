// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'

// A `Field` holds one control, and the reason changed under it without the rule changing. It used to render a `<label>` wrapped round everything, where the first labelable thing inside took the label's words as its own name: "Ours to sell" read out as "Whose house", "Cheque" read out as "How paid How paid". Found in four places by four different accidents, and `Choices` exists to fix it.

// `Field` is now a group with a label pointing at an id the field hands its control, and the same rule holds for a sharper reason: there is one id to give. Two controls in one `Field` are handed the same one, so the document has two elements answering to a single name and the label reaches whichever comes first. Asserted as rendered output in `Field.test.tsx`; this is where it is kept off the screens.

// `Picker` was in this list until const measured it: it was a `<select>`, #89 deleted it, and `Pick` that replaced it was never added. So the matcher was blind to this app's primary picker on ten call sites, and two `Pick`s in one `Field` -- the exact defect this exists to prevent -- reported nothing at all. The floor above had already been re-anchored off `Picker`; the list underneath it had not, which is the same rot one level down.

// `Day` is in this list for the reason `Pick` is: it is a question this app asks, on four screens today and on the four still to convert, and a list of names that does not have it is blind to the defect this exists to catch. Put in by the change that created it, because the gap `Pick` left open was never that somebody took it out -- it was that nobody put it in.

/** Everything a `Field` would try to name, which is every element a person can put an answer into. */
const A_CONTROL = /<(Line|Lines|Pick|Day|MoneyLine|input|select|textarea|button)\b/g

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
  // A group of choices is the case this was found in four times. No one of them is the answer, so none of them can be what the field's label points at: a radio group is named by pointing the other way, which is what `Choices` does.
  if (/role="(radio|checkbox|switch)"/.test(block) || /type="(radio|checkbox)"/.test(block)) {
    return 'a row of choices inside a Field, which cannot be named by pointing at one of them: use Choices'
  }

  // The field already writes the label for what it holds. A second one competes with it for the same control, and usually arrived with something that brought its own.
  if (/<label\b/.test(block)) {
    return 'a label inside a Field, which already has one'
  }

  const controls = block.match(A_CONTROL) ?? []
  if (controls.length > 1) {
    return `${controls.length} controls inside one Field (${controls.join(' ')}), which would share one id between them`
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
    // The day sheet's own row of ways to pay until they moved into `HowItWasPaid`, which every screen that takes money now draws. The rule is the same and the file that holds it is one instead of three.
    expect(usingChoices).toContain('components/form/HowItWasPaid.tsx')
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
    // Not the same defect, the same cause: the field has one id and one label, and the second answer gets neither of them to itself. Rendered and asserted in `Field.test.tsx` -- both boxes really do come out carrying the same id.
    expect(
      whatIsWrongWithTheField('<Field label="Name"><Line value={first} /><Line value={second} /></Field>')
    ).toContain('2 controls')
    expect(whatIsWrongWithTheField('<Field label="Number"><Line value={one} /><label>and</label>')).toContain(
      'a label inside a Field'
    )

    // In the shape this app really writes, which is what the matcher was blind to. `Pick` is on ten call sites and was not in the list; `Picker`, which is on none, was.
    expect(
      whatIsWrongWithTheField('<Field label="What for"><Pick chosen={a} choices={x} /><Pick chosen={b} choices={y} />')
    ).toContain('2 controls')
    expect(
      whatIsWrongWithTheField('<Field label="What for"><Pick chosen={a} choices={x} /><Line value={n} />')
    ).toContain('2 controls')
  })

  it('leaves a question with one answer in it alone', () => {
    expect(
      whatIsWrongWithTheField('<Field label="Name" problem={x}><Line value={name} aria-label="Name" /></Field>')
    ).toBeNull()
    expect(
      whatIsWrongWithTheField('<Field label="What for"><Pick chosen={trade} choices={trades} /></Field>')
    ).toBeNull()
    // And a component whose name merely begins with one of theirs is not one of them. `Picker` used to be in the list itself, which is how a plant written in its shape went on passing after the thing was deleted.
    expect(whatIsWrongWithTheField('<Field label="Where it has got to"><Picker value={stage} /></Field>')).toBeNull()
    // And a row of choices outside a `Field` is the fix, so the sweep does not pick it up at all.
    expect(fieldsIn('<Choices label="Whose house"><button role="radio">Ours to sell</button></Choices>')).toEqual([])
    // Nor does a component whose name only begins the same way.
    expect(fieldsIn('<Fieldwork value={x} />')).toEqual([])
  })
})
