// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { withoutComments } from './testing/source'

// Nauman: "Go through the whole app and I need you to make sure that everything is a ShadCN component."

// `Button` and `WayOut` were rebuilt on shadcn's the same evening, and that changed what they are *made of*. It made nothing use them. Thirty-five `<button>` were still written by hand across eighteen files, and two of those arrived that night in a feature merged under 997 passing tests: `Pay it more than one way` shipped as a bare button at `text-sm` with no padding at all -- a tap target the height of its own text, about 20px, opening the primary new interaction on the day sheet.

// So the instruction was true of the two components he had been shown and unenforced everywhere else, which is the thing he has objected to twice: we fix the instance he points at rather than the rule he states.

// This is the rule. It is deliberately about what a control *is to a person* rather than about a tag: `<div role="button">` is a button to everybody except a grep for `<button`, and sweeping by tag is the mistake three instruments made tonight -- each one true, each subject narrower than its rule.

/** And every way of being one without saying so. A role is what a screen reader is told and what a person sees; the tag underneath is an implementation detail that changes nothing about either. */
const A_BUTTON_BY_ROLE = ['button', 'link', 'menuitem', 'tab', 'switch']

// shadcn's own, copied in by their CLI, and left out of this the way every guard here leaves them out.

// Which turns out to be a formality rather than a real exception, and it makes this rule cleaner than intended: **not one file in this repository writes `<button>` in code.** shadcn's own reaches the tag as the string `'button'` handed to a `Slot`, and `Button` and `WayOut` have written nothing since they were rebuilt on it. So once the screens are converted the rule has no exceptions at all -- there is no file whose job is to write this tag. The two lines excusing ours were written before that was checked, and deleted after.
const THEIRS = 'components/ui/'

// A row of choices is a different control and a different fix -- it becomes shadcn's `RadioGroup`, which is its own change -- so `<button role="radio">` is not counted here.

// Excused by **shape rather than by file**, and that distinction is the whole of it. The first version of this excused whole files, and `Trades.tsx` holds five buttons of which one is a choice: exempting the file would have hidden four real ones behind it, permanently, in a list that reads as deliberate.
const A_CHOICE_INSTEAD = 'radio'

// The gallery is not the app. It is the harness that draws the app's screens, nobody using the ledger ever sees it, and holding it to a rule about his controls would be holding a camera to the rules of what it photographs.
const NOT_THIS_RULE: Record<string, string> = {
  'gallery/Gallery.tsx': 'the harness that draws the screens, which nobody using the ledger sees',
}

/** Everything between `<button` and the `>` that closes the opening tag. Braces are counted, because a `>` inside an arrow function in an `onClick` is not the end of the tag -- the trap that has made three sweeps of this shape report a smaller, tidier number than the truth. */
function attributesAt(source: string, at: number): string {
  let depth = 0

  for (let index = at; index < source.length; index += 1) {
    const letter = source[index]
    if (letter === '{') depth += 1
    else if (letter === '}') depth -= 1
    else if (letter === '>' && depth === 0) return source.slice(at, index)
  }

  return source.slice(at)
}

/** Every place a file makes a button itself, said the way somebody would say it. */
export function aButtonWrittenByHand(written: string): Array<string> {
  const source = withoutComments(written)
  const found: Array<string> = []

  // Counted one at a time rather than asked as "does this file contain one", because the answer per file is what decides whether a whole file gets excused -- and a file is the wrong unit for an excuse.
  for (const opened of source.matchAll(/<button[\s>/]/g)) {
    const attributes = attributesAt(source, opened.index)

    if (new RegExp(`role=["']${A_CHOICE_INSTEAD}["']`).test(attributes)) continue

    found.push('<button> written by hand')
  }

  // And asked of the role rather than of the element wearing it, because that is the point: the tag is not what makes something a button to anybody. Nothing in the app wears one of these today, so this half is proved against fixtures below rather than against the tree -- it is here to catch the first one.
  for (const role of A_BUTTON_BY_ROLE) {
    if (new RegExp(`role=["']${role}["']`).test(source)) {
      found.push(`role="${role}" on something this app drew itself`)
    }
  }

  return found
}

/** What a row of choices is, counted the same way, so the work still owed to `RadioGroup` is a number somebody can see rather than a silence. */
export function aChoiceWrittenByHand(written: string): number {
  return [...withoutComments(written).matchAll(/<button[\s>/]/g)].filter((opened) =>
    new RegExp(`role=["']${A_CHOICE_INSTEAD}["']`).test(attributesAt(withoutComments(written), opened.index))
  ).length
}

describe('a button written by hand', () => {
  const ours = everyScreen().filter(({ path }) => !path.startsWith(THEIRS))

  it('is on none of our screens', () => {
    const written = ours
      .filter(({ path }) => !(path in NOT_THIS_RULE))
      .flatMap(({ path, source }) => aButtonWrittenByHand(source).map((said) => `${path}: ${said}`))

    expect(written).toEqual([])
  })

  it('still names what is excused, so an exemption cannot outlive what it excuses', () => {
    // The other end. An exemption that has stopped being true reads exactly like one that is still needed, and this list had one within the hour: it named `DaySheet.tsx` as a row of choices, and the split-payment change had already moved those choices into `HowItWasPaid.tsx`. The file was excused for something no longer in it, and this is what said so.
    for (const [path, why] of Object.entries(NOT_THIS_RULE)) {
      const screen = ours.find((one) => one.path === path)

      expect(screen, `${path} is excused as "${why}" and is not a file this app has`).toBeDefined()
      expect(
        aButtonWrittenByHand(screen?.source ?? ''),
        `${path} is excused as "${why}" and has nothing in it`
      ).not.toEqual([])
    }
  })

  it('says how many rows of choices are still waiting on RadioGroup, rather than saying nothing', () => {
    // The other half of what this rule does not cover. `<button role="radio">` is skipped above because it is a different control with a different fix -- and skipped quietly is how a hole becomes permanent.

    // Counted rather than listed by file, for the reason the exemption is by shape: `Trades.tsx` holds five buttons of which one is a choice, so a file named here would excuse four real ones.
    const choices = ours.reduce((so, { source }) => so + aChoiceWrittenByHand(source), 0)

    expect(choices, 'no row of choices is written by hand any more, so this line and the skip above can go').toBe(6)
  })

  it('is asked of the screens that each wrote one', () => {
    // The floor, anchored on the fix rather than on a count. These are files the rule was written about, and a sweep that stopped opening them reports the same clean result as an app where every button is ours.
    const paths = ours.map(({ path }) => path)

    for (const path of [
      'components/form/HowItWasPaid.tsx',
      'components/site/ChangeTheContract.tsx',
      'components/sites/ChangeTheHouse.tsx',
      'components/people/People.tsx',
      'components/site/SpentByTrade.tsx',
    ]) {
      expect(paths, `${path} is what this rule is about and the sweep is not opening it`).toContain(path)
    }
  })

  it('has each of them pressing one of ours instead', () => {
    // Absence of a `<button>` is also what a screen with nothing to press looks like. Each of them has to be reaching for the app's own control, not merely be innocent of the tag.
    for (const path of ['components/form/HowItWasPaid.tsx', 'components/sites/ChangeTheHouse.tsx']) {
      const screen = ours.find((one) => one.path === path)

      expect(screen?.source, `${path} presses nothing at all`).toMatch(/<(Button|WayOut)\b/)
    }
  })

  it('would notice the one that shipped at twenty pixels', () => {
    // Verbatim in the shape it merged in, hours after every button in the app became shadcn's underneath.
    expect(
      aButtonWrittenByHand(
        '<button type="button" className="text-primary self-start text-sm font-medium">Pay it more than one way</button>'
      )
    ).toEqual(['<button> written by hand'])
  })

  it('would notice one wearing the role instead of the tag, which a sweep by tag cannot', () => {
    // The hole in the obvious version of this rule. A `<div role="button">` is a button to a person and to a screen reader, and satisfies "no bare `<button>`" completely.
    expect(aButtonWrittenByHand('<div role="button" onClick={open}>Change it</div>')).toEqual([
      'role="button" on something this app drew itself',
    ])
    expect(aButtonWrittenByHand('<span role="link" onClick={go}>More</span>')).toEqual([
      'role="link" on something this app drew itself',
    ])
  })

  it('leaves alone what is already ours', () => {
    expect(aButtonWrittenByHand('<Button onClick={send}>Put them in</Button>')).toEqual([])
    expect(aButtonWrittenByHand('<WayOut onClick={undo}>Take it back</WayOut>')).toEqual([])
    expect(aButtonWrittenByHand('<Day label="Agreed on" value={day} onPick={setDay} />')).toEqual([])
  })

  it('reads the code and not what is written about it', () => {
    // Every replacement in this sweep leaves a line saying what it used to be, and three counts in one evening were prose plus code. Two of the thirty-five were the word inside a comment somebody had written that hour.
    expect(aButtonWrittenByHand('// it was a <button> with no padding at all\nconst x = 1')).toEqual([])
    expect(aButtonWrittenByHand('/* a <div role="button"> is still a button */\nconst y = 2')).toEqual([])
    // And the code under the comment is still read.
    expect(aButtonWrittenByHand('// no more <button>\n<button type="button">Go</button>')).toEqual([
      '<button> written by hand',
    ])
  })

  it('has no file of its own that writes one, which is why the rule has no exception', () => {
    // Checked rather than assumed, and the check is what made the rule simpler. Two lines here excused `Button` and `WayOut` as the files allowed to write the tag -- and neither has written it since they were rebuilt on shadcn's, which reaches it as the string `'button'` handed to a `Slot` rather than as a tag at all.

    // So this is not "every button goes through ours". It is that **nothing in this repository writes a `<button>`**, and the day something does, it is a screen that has gone round the rule.
    for (const path of ['components/form/Button.tsx', 'components/form/WayOut.tsx', 'components/ui/button.tsx']) {
      const screen = everyScreen().find((one) => one.path === path)

      expect(screen, `${path} is not a file this app has`).toBeDefined()
      expect(aButtonWrittenByHand(screen?.source ?? ''), `${path} has started writing the tag itself`).toEqual([])
    }
  })
})
