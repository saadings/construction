import { describe, expect, it } from 'vitest'

import { calendarDay, chequeNumber, money, note, pakistaniMobile, personName } from './primitives'

function refusalFor(schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown): string {
  const result = schema.safeParse(value) as { success: boolean; error?: { issues: Array<{ message: string }> } }
  return result.success ? '' : (result.error?.issues[0]?.message ?? '')
}

// The words the design bans on screen, plus the vocabulary a Zod default message is written in.
const BANNED_ON_SCREEN =
  /\b(record|entry|entity|ledger|sync|category|vendor|field|validation|required|error|database|query|invalid|expected|received|NaN)\b/i

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
})

describe('a mobile number', () => {
  it('normalises every way the workbooks write one', () => {
    for (const typed of ['03214276376', '0321-4276376', '0321 4276376', '+923214276376', '92 321 4276376']) {
      expect(pakistaniMobile.parse(typed)).toBe('0321-4276376')
    }
  })

  it('refuses a number that is not a Pakistani mobile', () => {
    expect(pakistaniMobile.safeParse('042-35880000').success).toBe(false)
    expect(pakistaniMobile.safeParse('0321-427637').success).toBe(false)
  })
})

describe('a cheque number', () => {
  it('keeps what was written on the cheque', () => {
    expect(chequeNumber.parse(' 3894 ')).toBe('3894')
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
