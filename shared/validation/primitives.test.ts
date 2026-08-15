import { describe, expect, it } from 'vitest'

import { bankAccountLabel } from './bankAccount'
import { calendarDay, chequeNumber, money, note, pakistaniMobile, personName, whatIsWrong } from './primitives'
import { addressPart, siteName } from './site'

function refusalFor(schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown): string {
  const result = schema.safeParse(value) as { success: boolean; error?: { issues: Array<{ message: string }> } }
  return result.success ? '' : (result.error?.issues[0]?.message ?? '')
}

// The words the design bans on screen, plus the vocabulary a Zod default message is written in.
const BANNED_ON_SCREEN =
  /\b(record|entry|entity|ledger|sync|category|vendor|field|validation|required|error|database|query|invalid|expected|received|NaN)\b/i

// The rule that made this file worth rereading: one sentence answering several different mistakes is a wrong answer to most of them.

// Every rule with a floor and a ceiling is here. A new one that says the same thing at both ends fails this the day it is written.
describe('one mistake, one sentence', () => {
  const BOUNDED = [
    { what: 'a person', rule: personName, tooShort: 'A', tooLong: 'x'.repeat(81) },
    { what: 'a cheque number', rule: chequeNumber, tooShort: '', tooLong: '9'.repeat(40) },
    { what: 'the name of a house', rule: siteName, tooShort: 'R', tooLong: 'x'.repeat(81) },
    { what: 'a part of an address', rule: addressPart, tooShort: '', tooLong: 'x'.repeat(41) },
    { what: 'the name of an account', rule: bankAccountLabel, tooShort: 'H', tooLong: 'x'.repeat(41) },
  ]

  it.each(BOUNDED)('$what says one thing for nothing typed and another for too much', ({ rule, tooShort, tooLong }) => {
    const forTooShort = refusalFor(rule, tooShort)
    const forTooLong = refusalFor(rule, tooLong)

    expect(forTooShort.length).toBeGreaterThan(0)
    expect(forTooLong.length).toBeGreaterThan(0)
    expect(forTooShort).not.toBe(forTooLong)
  })

  it.each(BOUNDED)('$what says both of them in words a phone can show', ({ rule, tooShort, tooLong }) => {
    expect(refusalFor(rule, tooShort)).not.toMatch(BANNED_ON_SCREEN)
    expect(refusalFor(rule, tooLong)).not.toMatch(BANNED_ON_SCREEN)
  })

  it('tells an amount that is not one apart from an amount too big to hold', () => {
    // Both were "Put in how much was paid, in numbers", which is a lie told to somebody who typed 999,999,999,999.
    expect(refusalFor(money, 'sixty thousand')).not.toBe(refusalFor(money, '99,999,999,999'))
    expect(refusalFor(money, '99,999,999,999')).not.toMatch(BANNED_ON_SCREEN)
  })

  it('tells a day that is not one apart from a day not on the calendar', () => {
    // 31.04 is a slip on the day, and saying so is the difference between correcting it and retyping the lot.
    expect(refusalFor(calendarDay, 'Alasdfas')).not.toBe(refusalFor(calendarDay, '31.04.2025'))
    expect(refusalFor(calendarDay, '31.04.2025')).not.toMatch(BANNED_ON_SCREEN)
  })
})

describe('an amount someone typed', () => {
  it('arrives as paisa, not as what was typed', () => {
    expect(money.parse('6,057,704.50')).toBe(605770450)
  })

  it('refuses nothing, because a payment of nothing is a mistake', () => {
    expect(money.safeParse('0').success).toBe(false)
  })

  it('allows money coming back', () => {
    expect(money.parse('-8500')).toBe(-850000)
  })

  it('says what to do rather than naming a type', () => {
    // The person reading this is not a developer. "Invalid input: expected number, received string" tells them nothing.
    const said = refusalFor(money, 'sixty thousand')

    expect(said.length).toBeGreaterThan(0)
    expect(said).not.toMatch(BANNED_ON_SCREEN)
  })

  it('would notice a message written in the wrong vocabulary', () => {
    // The control. Without it the check above passes on any message at all, including an empty one.
    expect(BANNED_ON_SCREEN.test('Invalid input: expected number, received string')).toBe(true)
    expect(BANNED_ON_SCREEN.test('This field is required')).toBe(true)
  })
})

describe('the day of a payment', () => {
  it('accepts the way dates are written in the workbooks', () => {
    expect(calendarDay.parse('07.10.2025')).toBe('2025-10-07')
  })

  it('refuses a day nobody on earth has reached yet', () => {
    const dayAfterTomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)

    expect(calendarDay.safeParse(dayAfterTomorrow).success).toBe(false)
  })

  it('refuses the ditto mark, which means nothing once rows can be sorted', () => {
    expect(calendarDay.safeParse('"').success).toBe(false)
  })
})

describe('a person', () => {
  it('trims what was typed and collapses run-together spaces', () => {
    expect(personName.parse('  Malik   Sharif  Awan ')).toBe('Malik Sharif Awan')
  })

  it('refuses a single letter, which is never a name', () => {
    expect(personName.safeParse('A').success).toBe(false)
  })

  it('refuses a name of only spaces', () => {
    expect(personName.safeParse('     ').success).toBe(false)
  })

  it('asks for one in words that are true wherever it is asked for', () => {
    // The same rule is behind "Name" on the people screen and behind who was paid on the day sheet. Nauman was adding partners, investors and clients and being told to put in the name of the person or shop paid.
    expect(whatIsWrong(personName, 'S')).toBe('Put in a name. A person, a shop or a company.')
    expect(whatIsWrong(personName, 'S')).not.toMatch(/paid|payment|owed|invest|client/i)
  })
})

describe('a mobile number', () => {
  it('normalises every way the workbooks write one', () => {
    for (const typed of ['03000000000', '0300-0000000', '0300 0000000', '+923000000000', '92 300 0000000']) {
      expect(pakistaniMobile.parse(typed)).toBe('0300-0000000')
    }
  })

  it('refuses a number that is not a Pakistani mobile', () => {
    expect(pakistaniMobile.safeParse('042-35880000').success).toBe(false)
    expect(pakistaniMobile.safeParse('0300-000000').success).toBe(false)
  })
})

describe('a cheque number', () => {
  it('keeps what was written on the cheque', () => {
    expect(chequeNumber.parse(' 0001 ')).toBe('0001')
  })

  it('refuses something far too long to be one', () => {
    expect(chequeNumber.safeParse('9'.repeat(40)).success).toBe(false)
  })
})

describe('a note', () => {
  it('keeps the wording, only trimming the ends', () => {
    const written = 'EXTRA WORK FOUNDATION PLASTERING NOT INCLUDED IN PAYMENT'

    expect(note.parse(`  ${written}  `)).toBe(written)
  })

  it('refuses one long enough to be a pasted document', () => {
    expect(note.safeParse('x'.repeat(500)).success).toBe(false)
  })
})
