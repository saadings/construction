import type { ZodType } from 'zod'
import { z } from 'zod'

import { notInTheFuture, readCalendarDate } from '../calendarDate'
import { readRupees } from '../money'

// Written once and reused, so the form, the server and the types cannot drift apart.

// What is wrong with one answer, in the words the server would refuse it with. The first problem and no more, which is the same rule `checked()` follows on the way in: eight problems at once reads as the app being broken rather than as a question unanswered.
export function whatIsWrong(rule: ZodType, typed: unknown): string | null {
  const read = rule.safeParse(typed)

  return read.success ? null : (read.error.issues[0]?.message ?? 'Check what you have put in.')
}

// One mistake, one sentence. A rule that answers "nothing there", "too long" and "not that at all" with a single message tells whoever typed 50 that he did not put in square feet, when he did.

// A floor comes with the words for falling under it, or not at all: nothing typed is a perfectly good note, and a rule with no floor should not have to carry a sentence nobody can reach.
type Bounds = { atMost: number; tooLong: string } & (
  | { atLeast: number; tooShort: string }
  | { atLeast?: undefined; tooShort?: undefined }
)

export function boundedText(bounds: Bounds) {
  return z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .superRefine((value, ctx) => {
      if (bounds.tooShort !== undefined && value.length < bounds.atLeast) {
        ctx.addIssue({ code: 'custom', message: bounds.tooShort })
      } else if (value.length > bounds.atMost) {
        ctx.addIssue({ code: 'custom', message: bounds.tooLong })
      }
    })
}

export const money = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const read = readRupees(value)

  if (!read.ok) {
    ctx.addIssue({
      code: 'custom',
      // Never one sentence for both. Telling somebody who typed 999,999,999,999 that it is not a number is how an app teaches people not to read it.
      message:
        read.why === 'largerThanWeKeep'
          ? 'That is more than this keeps track of. Check the figure.'
          : 'Put in how much was paid, in numbers.',
    })
    return z.NEVER
  }

  if (read.paisa === 0) {
    ctx.addIssue({ code: 'custom', message: 'Put in how much was paid.' })
    return z.NEVER
  }

  return read.paisa
})

// Money that cannot be less than nothing: a rate, a unit price, a sum agreed. `money` allows a minus because a payment can come back out, and that is right where it came from and wrong everywhere a price is meant.

// Named here so the next rate cannot reach for `money` out of habit, which is how a rate of minus two thousand four hundred became a contract worth less than nothing.
export const positiveMoney = money.refine((paisa) => paisa > 0, {
  message: 'Put in an amount greater than nothing.',
})

export const calendarDay = z.string().transform((value, ctx) => {
  const read = readCalendarDate(value)

  if (!read.ok) {
    ctx.addIssue({
      code: 'custom',
      // A slip on the day is not the same as no date at all, and saying so is the difference between correcting 31.04 and retyping the lot.
      message:
        read.why === 'notOnTheCalendar' ? 'That day is not on the calendar. Check it.' : 'Pick the day this happened.',
    })
    return z.NEVER
  }

  if (!notInTheFuture(read.day)) {
    ctx.addIssue({ code: 'custom', message: 'Pick a day that has already happened.' })
    return z.NEVER
  }

  return read.day
})

export const personName = boundedText({
  atLeast: 2,
  atMost: 80,
  tooShort: 'Put in the name of the person or shop paid.',
  tooLong: 'Keep the name shorter.',
})

// Written five different ways across the workbooks, so every one of them is normalised rather than refused.
export const pakistaniMobile = z
  .string()
  .transform((value) => value.replace(/\D/g, '').replace(/^92/, '0'))
  .refine((digits) => /^03\d{9}$/.test(digits), {
    message: 'Put in a mobile number, like 0300-0000000.',
  })
  .transform((digits) => `${digits.slice(0, 4)}-${digits.slice(4)}`)

export const chequeNumber = boundedText({
  atLeast: 1,
  atMost: 20,
  tooShort: 'Put in the number written on the cheque.',
  tooLong: 'That is longer than a cheque number. Put in what is printed on it.',
})

// No floor: nothing written is a perfectly good note.
export const note = boundedText({ atMost: 300, tooLong: 'Keep the note shorter.' })
