import { describe, expect, it } from 'vitest'

import { asDayHeWrites, isCalendarDate, notInTheFuture, parseCalendarDate, todayOnThisDevice } from './calendarDate'

describe('the day something happened', () => {
  it('reads the way the workbooks write dates', () => {
    expect(parseCalendarDate('07.10.2025')).toBe('2025-10-07')
    expect(parseCalendarDate('28.11.24')).toBe('2024-11-28')
  })

  it('reads what a date picker gives back', () => {
    expect(parseCalendarDate('2025-10-07')).toBe('2025-10-07')
  })

  it('accepts the leap day in a leap year and refuses it otherwise', () => {
    expect(parseCalendarDate('29.02.2024')).toBe('2024-02-29')
    expect(() => parseCalendarDate('29.02.2025')).toThrow()
  })

  describe('what it refuses', () => {
    it.each([
      ['a day that does not exist', '31.02.2025'],
      ['a month that does not exist', '01.13.2025'],
      ['the ditto mark the workbooks use', '"'],
      ['nothing at all', ''],
      ['a word', 'yesterday'],
      ['a moment rather than a day', '2025-10-07T09:00:00Z'],
    ])('refuses %s', (_case, input) => {
      expect(() => parseCalendarDate(input)).toThrow()
    })
  })

  it('recognises its own output', () => {
    expect(isCalendarDate('2025-10-07')).toBe(true)
    expect(isCalendarDate('07.10.2025')).toBe(false)
    expect(isCalendarDate('2025-13-01')).toBe(false)
  })
})

describe('which day it is', () => {
  it('gives the day the person is living in, late in the evening', () => {
    // Read from the device, never converted. A zone here would be the invented moment the design forbids.
    expect(todayOnThisDevice(new Date(2025, 9, 7, 21, 30))).toBe('2025-10-07')
  })

  it('gives the next day just after midnight', () => {
    expect(todayOnThisDevice(new Date(2025, 9, 8, 0, 15))).toBe('2025-10-08')
  })
})

describe('a day written the way he writes one', () => {
  it('is the day first and the month second', () => {
    // Nauman: "Date should be in this: DD/MM/YYYY". Every day here is after the twelfth on purpose: on the sixth of July both orders read 06/07 and 07/06, and a test that cannot tell them apart is a test about nothing. The whole string is asserted rather than a piece of it, for the same reason.
    expect(asDayHeWrites('2026-08-16')).toBe('16/08/2026')
    expect(asDayHeWrites('2026-06-30')).toBe('30/06/2026')
    expect(asDayHeWrites('2025-12-31')).toBe('31/12/2025')
  })

  it('keeps both leading zeroes, so every date is the same width in a column', () => {
    expect(asDayHeWrites('2026-01-05')).toBe('05/01/2026')
    expect(asDayHeWrites('2026-09-09')).toBe('09/09/2026')
  })

  it('hands back anything that is not a day as it was', () => {
    // A screen showing a stored value it cannot read must show that value, not an empty space where a date should be.
    for (const said of ['', 'not a day', '16/08/2026', '2026-8-6', '2026-08-16T00:00:00Z']) {
      expect(asDayHeWrites(said), `"${said}" came back changed`).toBe(said)
    }
  })

  it('needs no timezone, because there is no moment in it', () => {
    // The rearranging is done on the string. There is no midnight here to be on the wrong side of, which is the trap `asCalendarDate` exists for.
    const before = process.env.TZ

    try {
      for (const zone of ['Asia/Karachi', 'America/New_York', 'UTC']) {
        process.env.TZ = zone
        expect(asDayHeWrites('2026-08-16'), `in ${zone}`).toBe('16/08/2026')
      }
    } finally {
      process.env.TZ = before
    }
  })
})

describe('refusing a day that has not happened', () => {
  it('accepts a day ahead of UTC but not ahead of the person entering it', () => {
    // 1am on the 8th in Lahore is still the 7th in UTC. Refusing it stops anyone in Pakistan recording for hours each night.
    expect(notInTheFuture('2025-10-08', new Date('2025-10-07T20:00:00Z'))).toBe(true)
  })

  it('refuses a day ahead of every clock on earth', () => {
    // Civil offsets run UTC-12 to UTC+14, so nothing is two days ahead. This is not a timezone, it is a cheque not yet written.
    expect(notInTheFuture('2025-10-09', new Date('2025-10-07T20:00:00Z'))).toBe(false)
  })

  it('accepts today and the past', () => {
    const now = new Date('2025-10-07T12:00:00Z')
    expect(notInTheFuture('2025-10-07', now)).toBe(true)
    expect(notInTheFuture('2015-05-22', now)).toBe(true)
  })
})
