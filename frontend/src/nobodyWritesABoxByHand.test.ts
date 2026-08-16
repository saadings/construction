// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { tagsWrittenIn } from './testing/tags'

// Nauman: "everything should be done in shadcn ui".

// A box somebody types an answer into is never only a box. It is a name a screen reader can find, an id the name points at, a state for being wrong, and a rule about when being wrong may be said -- and five screens had written some of that out by hand and the rest not at all. Two of them copied `Field`'s own upper-case label rather than using `Field`, which is the copy that drifts.
const A_BOX_BY_HAND = ['input', 'textarea', 'label']

// shadcn's own, copied in by their CLI. Their `Input` *is* an `<input>` -- that is what it is for.
const THEIRS = 'components/ui/'

/** Where the boxes are allowed to be written, and which tag each of them exists to write, so the exception below is an exception to something that exists. */
const WHERE_THEIRS_IS = [
  { path: 'components/ui/input.tsx', writes: 'input' },
  { path: 'components/ui/textarea.tsx', writes: 'textarea' },
]

/** shadcn's label, which writes no `<label>` of its own: it hands the job to Radix, and the tag on the screen is drawn there. So nothing in this repository writes one at all -- and this is where that stops being true if it ever does. */
const THEIR_LABEL = 'components/ui/label.tsx'

/** The screens that each wrote one out, named so this cannot pass by having stopped looking at them. */
const THEY_USED_TO_WRITE_ONE = [
  'components/daySheet/MoneyLine.tsx',
  'components/daySheet/DaySheet.tsx',
  // `AddAnAccount.tsx` until the picker took the job over: adding an account is asked inside the control that found it missing, so the file that used to write this box is the one below.
  'components/form/PickAnAccount.tsx',
  'components/site/Stages.tsx',
  'components/form/Field.tsx',
]

/** Every place a screen opens a box itself. */
export function writtenByHandIn(written: string): Array<string> {
  return tagsWrittenIn(written, A_BOX_BY_HAND)
}

describe('a box written by hand', () => {
  const ours = everyScreen().filter(({ path }) => !path.startsWith(THEIRS))

  it('is on none of our screens', () => {
    const written = ours.flatMap(({ path, source }) =>
      writtenByHandIn(source).map((tag) => `${path}: <${tag}> is written by hand, not shadcn's`)
    )

    expect(written).toEqual([])
  })

  it('is asked of the five screens that each wrote one', () => {
    // The floor, anchored on the fix rather than on a count: these five are what the rule was written about, and a sweep that stopped opening them would report the same clean result.
    const paths = ours.map(({ path }) => path)

    for (const path of THEY_USED_TO_WRITE_ONE) {
      expect(paths, `${path} is what this rule is about and the sweep is not opening it`).toContain(path)
    }
  })

  it('has each of them asking through the form instead', () => {
    // Absence of an `<input>` is also what a screen with nothing to answer looks like. Each of the five has to be reaching a box through the app's own form, not merely be innocent of the tag.
    for (const path of THEY_USED_TO_WRITE_ONE) {
      const screen = ours.find((one) => one.path === path)

      expect(screen?.source, `${path} writes no box and asks for none either`).toMatch(/<(Line|Lines|Field|Input)\b/)
    }
  })

  it('leaves shadcn their own, which are the files these tags exist in', () => {
    // The exception, proved rather than assumed. If their `Input` stopped being an input, the rule above would still pass over an app with no box in it anywhere.
    const theirs = everyScreen()

    for (const { path, writes } of WHERE_THEIRS_IS) {
      const written = theirs.find((one) => one.path === path)

      expect(written, `${path} is where a box is allowed to be written and it is not there`).toBeDefined()
      expect(writtenByHandIn(written?.source ?? ''), `${path} no longer writes the tag it exists for`).toEqual([writes])
    }

    // Their label writes no tag at all: Radix draws it. Worth asserting rather than assuming, because "no `<label>` in the file" is equally what a label that has stopped being one looks like.
    const label = theirs.find((one) => one.path === THEIR_LABEL)

    expect(writtenByHandIn(label?.source ?? '')).toEqual([])
    expect(label?.source, `${THEIR_LABEL} no longer hands the tag to Radix, so nothing draws a label`).toContain(
      'LabelPrimitive.Root'
    )

    expect(ours.map(({ path }) => path).filter((path) => path.startsWith(THEIRS))).toEqual([])
  })

  it('would notice each of the shapes it replaced', () => {
    // Verbatim, in the shape each screen actually had.
    expect(writtenByHandIn('<input type="date" value={day} className="bg-transparent text-right" />')).toEqual([
      'input',
    ])
    expect(writtenByHandIn('<label className="flex flex-col gap-1">')).toEqual(['label'])
    expect(writtenByHandIn('<textarea rows={2} value={note} />')).toEqual(['textarea'])
    // And the one that was both: a hand-written field, which is `Field` copied rather than used.
    expect(writtenByHandIn('<label className="flex flex-col gap-1.5"><span>How much</span><input /></label>')).toEqual([
      'input',
      'label',
    ])
  })

  it('reads the code and not what is written about it', () => {
    expect(writtenByHandIn('// it wrote its own <label> and its own <input>\nconst x = 1')).toEqual([])
    expect(writtenByHandIn('/* a <textarea> with its own classes */\nconst y = 2')).toEqual([])
    expect(writtenByHandIn('// no more <input>\n<input value={x} />')).toEqual(['input'])
  })

  it('leaves alone the components that only look like them', () => {
    expect(writtenByHandIn('<Line look="beside" type="date" value={day} />')).toEqual([])
    expect(writtenByHandIn('<Lines rows={3} />')).toEqual([])
    expect(writtenByHandIn('<Input id={asked.id} />')).toEqual([])
    expect(writtenByHandIn('<FieldLabel htmlFor={named}>')).toEqual([])
    expect(writtenByHandIn('<InputGroup />')).toEqual([])
    expect(writtenByHandIn('const labelled = accounts.map(one)')).toEqual([])
  })
})
