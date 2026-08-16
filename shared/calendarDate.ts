// A day, not a moment: the workbooks record 07.10.2025 and nothing finer, and a timestamp files a 9pm Lahore payment on the previous day.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const TYPED_DAY = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$/

// Civil offsets run UTC-12 to UTC+14, so no device is ever more than one calendar day ahead of UTC.
const FURTHEST_ANY_DEVICE_RUNS_AHEAD_MS = 24 * 60 * 60 * 1000

function isRealDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function assemble(year: number, month: number, day: number): string {
  if (!isRealDay(year, month, day)) {
    throw new Error('That day does not exist.')
  }

  const pad = (value: number, width: number) => String(value).padStart(width, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

export function isCalendarDate(value: string): boolean {
  const match = ISO_DAY.exec(value)
  return match !== null && isRealDay(Number(match[1]), Number(match[2]), Number(match[3]))
}

// Two different mistakes, kept apart: something that is not a date at all, and a date nobody could have written down -- 31.02 is a slip on the day, not on the whole thing.
export type DayRead = { ok: true; day: string } | { ok: false; why: 'notADate' | 'notOnTheCalendar' }

export function readCalendarDate(input: string): DayRead {
  const text = input.trim()

  const parts = partsOfAWrittenDay(text) ?? partsOfATypedDay(text)
  if (parts === null) {
    return { ok: false, why: 'notADate' }
  }

  const [year, month, day] = parts
  if (!isRealDay(year, month, day)) {
    return { ok: false, why: 'notOnTheCalendar' }
  }

  return { ok: true, day: assemble(year, month, day) }
}

// How it is stored and how it comes back from a date field: 2025-10-07.
function partsOfAWrittenDay(text: string): readonly [number, number, number] | null {
  const written = ISO_DAY.exec(text)

  return written === null ? null : ([Number(written[1]), Number(written[2]), Number(written[3])] as const)
}

// How it is written by hand and in the workbooks: 07.10.2025, 7/10/25.
function partsOfATypedDay(text: string): readonly [number, number, number] | null {
  const typed = TYPED_DAY.exec(text)
  if (typed === null) {
    return null
  }

  const year = typed[3].length === 2 ? 2000 + Number(typed[3]) : Number(typed[3])
  return [year, Number(typed[2]), Number(typed[1])] as const
}

export function parseCalendarDate(input: string): string {
  const read = readCalendarDate(input)

  if (!read.ok) {
    throw new Error(read.why === 'notOnTheCalendar' ? 'That day does not exist.' : 'That is not a date.')
  }

  return read.day
}

// A moment read as the day it falls on where the reader is standing, rather than converted into one. `toISOString()` is the wrong instrument and is the one everybody reaches for: it answers in UTC, so a local midnight in Lahore comes back as the day before and a payment files itself a day early.
export function asCalendarDate(moment: Date): string {
  return assemble(moment.getFullYear(), moment.getMonth() + 1, moment.getDate())
}

// The date the person's own device shows, read rather than converted.
export function todayOnThisDevice(now: Date = new Date()): string {
  return asCalendarDate(now)
}

// Server side. Exact enforcement would need the entering person's zone, and carrying a zone is what the design forbids.
export function notInTheFuture(day: string, now: Date = new Date()): boolean {
  const furthest = new Date(now.getTime() + FURTHEST_ANY_DEVICE_RUNS_AHEAD_MS)
  return day <= assemble(furthest.getUTCFullYear(), furthest.getUTCMonth() + 1, furthest.getUTCDate())
}
