// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { drawnByTheBrowserIn } from './components/form/theBrowserDrawsItNot.test'
import { everyScreen } from './testing/screens'
import { withoutComments } from './testing/source'

// Nauman, having been shown a date: "Date should be in this: DD/MM/YYYY".

// The one he was looking at said 08/16/2026, which is the OS drawing an American order in a control nobody had replaced yet. But nothing here was writing it his way either: seven screens put the stored `2026-06-02` straight onto the page and the day picker said `16 Aug 2026`. Three orders for one thing, in an app whose whole job is that the figures agree.

// So there is one function, `asDayHeWrites`, and this is what keeps it the one. The same shape as the money rule beside it: a screen that reaches for the stored value directly is the drift, and it is invisible while you are writing the eighth one.

/** The fields that hold a `YYYY-MM-DD` day. Every one of them is stored the way the ledger stores a day and read by somebody who does not. */
const A_DAY = ['day', 'raisedOn', 'billedOn', 'agreedOn', 'paidOn', 'receivedOn', 'takenOn']

// Empty. Money coming in and paying out came out of it in the branch that split a payment between cash and cheques; `WhoIsOnThisHouse` is the last and it converts in this change.

// Kept rather than deleted, so a screen that starts showing a day tomorrow has somewhere for its name to go -- a list that has to be re-invented comes back as a skip. What has to be watched is the check underneath: a loop over an empty list passes by running no times.
const STILL_TO_CONVERT: Array<string> = []

/** Every place a screen hands a day to a control the OS draws, which then writes it in whatever order the device is set to. Borrowed rather than re-written: one reader, and it already knows that `type="date"` inside a comment is not a control. */
export function whereTheOSWritesADay(source: string): Array<string> {
  return drawnByTheBrowserIn(source).filter(
    (what) => what.startsWith('date') || what === 'time' || what === 'month' || what === 'week'
  )
}

/** Everything about a day that a screen has not converted yet, both halves together. */
export function whatIsLeftIn(source: string): Array<string> {
  return [...aDayWrittenRaw(source), ...whereTheOSWritesADay(source)]
}

/** Every place a screen puts a stored day straight onto the page. */
export function aDayWrittenRaw(written: string): Array<string> {
  const source = withoutComments(written)
  const found: Array<string> = []

  for (const field of A_DAY) {
    // A brace holding the field, with what comes before the name so `holiday` and `birthday` are not days, and what comes after so `dayOfWeek` is not one either.
    for (const at of source.matchAll(new RegExp(`\\{[^{}]*?(?<![\\w.])[\\w.]*\\.${field}\\b(?!\\w)[^{}]*\\}`, 'g'))) {
      const said = at[0]
      if (said.includes('asDayHeWrites') || said.includes('asAWeekday')) continue

      // A brace straight after an `=` is a prop, and a day handed to something else is that thing's business: it goes into a control that shows what it likes, or into a component that will decide for itself. A brace anywhere else in JSX is text somebody reads, and that is what this is about. One character, and it is the whole distinction -- an earlier version tried to work out which props were controls and could not tell `Billed {stage.billedOn}` from one.
      if (source[at.index - 1] === '=') continue

      // An object handed to a mutation is not something anybody reads: `{ ...forSite, day: receipt.day }` is an argument, and three routes have one. Told apart by the space, which is prettier's doing and not a coincidence -- it prints an object literal as `{ a, b }` and a rendered expression as `{expr}`, and prettier runs in the gate. Said here rather than relied on quietly, because a rule that rests on a formatter should be one somebody can find.
      if (/^\{\s/.test(said)) continue

      found.push(said.replace(/\s+/g, ' ').slice(0, 60))
    }
  }

  return found
}

describe('a day put on the page the way it is stored', () => {
  // shadcn's own are left out the way the guard this borrows from leaves them out: their `Input` *is* an `<input>`, and holding somebody else's component to this rule is how you come to maintain a fork of it.
  const screens = everyScreen().filter(({ path }) => !path.startsWith('components/ui/'))

  it('is on none of our screens, but the one still waiting on the picker work', () => {
    const raw = screens
      .filter(({ path }) => !STILL_TO_CONVERT.includes(path))
      .flatMap(({ path, source }) =>
        aDayWrittenRaw(source).map((said) => `${path}: ${said} is the stored day, not the one he asked for`)
      )

    expect(raw).toEqual([])
  })

  it('is not left to the OS either, which writes one in whatever order the device is set to', () => {
    // The hole this had, found in a picture rather than in the code. The day sheet at 390 showed `07/04/2026` at the top and `Sat 4 Jul` fifteen pixels under it -- the same variable twice, one written by the OS in American order, and under the rule above that string is the 7th of April. Two orders on one screen, in the change that existed to end three of them.

    // Not a mistake in the sweep above; the sweep's subject was narrower than the rule's. It asks where *we* write a day and is blind to the places we let the browser write one for us. So the rule is asked here as well: a control whose order we cannot set cannot satisfy "one way to write a day".
    const leftToTheOS = screens
      .filter(({ path }) => !STILL_TO_CONVERT.includes(path))
      .flatMap(({ path, source }) =>
        whereTheOSWritesADay(source).map((what) => `${path}: type="${what}" is written by the OS, in the OS's order`)
      )

    expect(leftToTheOS).toEqual([])
  })

  it('still names what is left, so the exemption cannot outlive it', () => {
    // The other end. An exemption that has stopped being true reads exactly like one that is still needed.
    for (const path of STILL_TO_CONVERT) {
      const screen = screens.find((one) => one.path === path)

      expect(screen, `${path} is exempted and is not a screen this app has`).toBeDefined()
      expect(whatIsLeftIn(screen?.source ?? ''), `${path} is exempted and has nothing left to convert`).not.toEqual([])
    }

    // And the check itself, against fixtures rather than against the app, because the list is now empty and a loop over nothing passes by running no times. This was written to catch a reader that had stopped seeing anything -- and it would have stopped being able to, on the day the last screen was converted. A floor that counts the defect is removed by the fix.

    // Both halves, and the boundary between them: a date control in code is something left to convert, one inside a comment is not, and a screen with neither is finished. The middle line is the one that keeps `Day.tsx`'s own comment from reading as a defect.
    expect(whatIsLeftIn('<Line value={day} type="date" />'), 'an OS control no longer reads as one').not.toEqual([])
    expect(whatIsLeftIn('<span>Billed {stage.billedOn}</span>'), 'a raw day no longer reads as one').not.toEqual([])
    expect(whatIsLeftIn('// it used to be `type="date"` and render {stage.billedOn}'), 'prose reads as code').toEqual(
      []
    )
    expect(whatIsLeftIn('<Day value={day} onPick={setDay} />'), 'anything at all now reads as unconverted').toEqual([])
  })

  it('is asked of the screens that really show a day', () => {
    // The floor, counted as screens that reach for the one function rather than as screens that are innocent of the raw form -- innocence is also what a sweep that stopped opening files reports.
    const using = screens.filter(({ source }) => source.includes('asDayHeWrites')).map(({ path }) => path)

    expect(using).toContain('components/site/Stages.tsx')
    expect(using).toContain('components/people/TheirAccount.tsx')
    expect(using.length).toBeGreaterThan(3)
  })

  it('would notice each of the four it was written for, in the shape each of them had', () => {
    expect(aDayWrittenRaw('<span>Billed {stage.billedOn}</span>')).toEqual(['{stage.billedOn}'])
    expect(aDayWrittenRaw('<span>Raised {bill.raisedOn}</span>')).toEqual(['{bill.raisedOn}'])
    expect(aDayWrittenRaw('<p>{went.day} · {SAID[went.method]}</p>')).toEqual(['{went.day}'])
    expect(aDayWrittenRaw('<span>\n        {line.day}\n      </span>')).toEqual(['{line.day}'])
  })

  it('leaves alone a day handed to something that will write it itself', () => {
    // The control takes the stored form and shows what it likes; a component handed a day is the same. Neither is a screen putting one on the page.
    expect(aDayWrittenRaw('<Day label="Raised on" value={raisedOn} onPick={setRaisedOn} />')).toEqual([])
    expect(aDayWrittenRaw('<Line value={day} onChange={change} />')).toEqual([])
    expect(aDayWrittenRaw('<DaySheet day={day} onChangeDay={setDay} />')).toEqual([])
    expect(aDayWrittenRaw('onBill(stage._id, day)')).toEqual([])

    // An object on its way to a mutation, which is what three of the routes hand over. Told apart by the space prettier puts inside an object literal and does not put inside a rendered expression.
    expect(aDayWrittenRaw('void putIn({ ...forSite, day: receipt.day, amountPaisa })')).toEqual([])
    expect(aDayWrittenRaw('return { siteId, day: bill.day }')).toEqual([])
    // And the rendered form, which has no space, is still caught -- or the line above would excuse everything.
    expect(aDayWrittenRaw('<span>{receipt.day}</span>')).toEqual(['{receipt.day}'])
  })

  it('leaves alone the one that is already asking the right question', () => {
    expect(aDayWrittenRaw('<span>Billed {asDayHeWrites(stage.billedOn)}</span>')).toEqual([])
    expect(aDayWrittenRaw('<p>{asDayHeWrites(went.day)} · {SAID[went.method]}</p>')).toEqual([])
    // And the day sheet's own header, which says a weekday rather than a date and is unambiguous either way.
    expect(aDayWrittenRaw('<span>{asAWeekday(day)}</span>')).toEqual([])
  })

  it('reads the code and not what is written about it', () => {
    // Every one of these was replaced by a line explaining what it used to be, and three counts in one evening were prose plus code.
    expect(aDayWrittenRaw('// it used to render {stage.billedOn} raw\nconst x = 1')).toEqual([])
    expect(aDayWrittenRaw('/* {went.day} was the stored form */\nconst y = 2')).toEqual([])
  })

  it('leaves alone a word that only ends the same way', () => {
    expect(aDayWrittenRaw('<span>{trip.holiday}</span>')).toEqual([])
    expect(aDayWrittenRaw('<span>{person.birthday}</span>')).toEqual([])
    expect(aDayWrittenRaw('<span>{what.dayOfWeek}</span>')).toEqual([])
  })
})
