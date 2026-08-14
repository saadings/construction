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

export function parseCalendarDate(input: string): string {
  const text = input.trim()

  const iso = ISO_DAY.exec(text)
  if (iso) {
    return assemble(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const typed = TYPED_DAY.exec(text)
  if (typed) {
    const year = typed[3].length === 2 ? 2000 + Number(typed[3]) : Number(typed[3])
    return assemble(year, Number(typed[2]), Number(typed[1]))
  }

  throw new Error('That is not a date.')
}

// The date the person's own device shows, read rather than converted.
export function todayOnThisDevice(now: Date = new Date()): string {
  return assemble(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

// Server side. Exact enforcement would need the entering person's zone, and carrying a zone is what the design forbids.
export function notInTheFuture(day: string, now: Date = new Date()): boolean {
  const furthest = new Date(now.getTime() + FURTHEST_ANY_DEVICE_RUNS_AHEAD_MS)
  return day <= assemble(furthest.getUTCFullYear(), furthest.getUTCMonth() + 1, furthest.getUTCDate())
}
