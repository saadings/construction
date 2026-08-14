import { describe, expect, it } from 'vitest'

import { isCalendarDate, notInTheFuture, parseCalendarDate, todayOnThisDevice } from './calendarDate'

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
