// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { withoutComments } from './testing/source'

// Nauman, having been shown a date: "Date should be in this: DD/MM/YYYY".

// The one he was looking at said 08/16/2026, which is the OS drawing an American order in a control nobody had replaced yet. But nothing here was writing it his way either: seven screens put the stored `2026-06-02` straight onto the page and the day picker said `16 Aug 2026`. Three orders for one thing, in an app whose whole job is that the figures agree.

// So there is one function, `asDayHeWrites`, and this is what keeps it the one. The same shape as the money rule beside it: a screen that reaches for the stored value directly is the drift, and it is invisible while you are writing the eighth one.

/** The fields that hold a `YYYY-MM-DD` day. Every one of them is stored the way the ledger stores a day and read by somebody who does not. */
const A_DAY = ['day', 'raisedOn', 'billedOn', 'agreedOn', 'paidOn', 'receivedOn', 'takenOn']

// The four screens that still put one on the page raw. Three are const-2's picker work and converting them from here would collide; the fourth is the day sheet's own header, which draws `Sun 16 Aug` through `niceDay` -- unambiguous, deliberate, and a weekday rather than a date.

// Listed rather than skipped, so a screen that starts showing a day tomorrow fails here on the day it is written rather than passing over a gap somebody already knew about.
const STILL_TO_CONVERT = [
  'components/moneyIn/ComingIn.tsx',
  'components/shares/PayOut.tsx',
  'components/site/WhoIsOnThisHouse.tsx',
]

/** Every place a screen puts a stored day straight onto the page. */
export function aDayWrittenRaw(written: string): Array<string> {
  const source = withoutComments(written)
  const found: Array<string> = []

  for (const field of A_DAY) {
    // A brace holding the field, with what comes before the name so `holiday` and `birthday` are not days, and what comes after so `dayOfWeek` is not one either.
    for (const at of source.matchAll(new RegExp(`\\{[^{}]*?(?<![\\w.])[\\w.]*\\.${field}\\b(?!\\w)[^{}]*\\}`, 'g'))) {
      const said = at[0]
      if (said.includes('asDayHeWrites') || said.includes('niceDay')) continue

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
  const screens = everyScreen()

  it('is on none of our screens, but the three still waiting on the picker work', () => {
    const raw = screens
      .filter(({ path }) => !STILL_TO_CONVERT.includes(path))
      .flatMap(({ path, source }) =>
        aDayWrittenRaw(source).map((said) => `${path}: ${said} is the stored day, not the one he asked for`)
      )

    expect(raw).toEqual([])
  })

  it('still names the three, so the exemption cannot outlive them', () => {
    // The other end. An exemption that has stopped being true reads exactly like one that is still needed.
    for (const path of STILL_TO_CONVERT) {
      const screen = screens.find((one) => one.path === path)

      expect(screen, `${path} is exempted and is not a screen this app has`).toBeDefined()
      expect(aDayWrittenRaw(screen?.source ?? ''), `${path} is exempted and has nothing left to convert`).not.toEqual(
        []
      )
    }
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
    expect(aDayWrittenRaw('<span>{niceDay(day)}</span>')).toEqual([])
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
