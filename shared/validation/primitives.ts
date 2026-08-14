import { z } from 'zod'

import { notInTheFuture, parseCalendarDate } from '../calendarDate'
import { rupeesToPaisa } from '../money'

// Written once and reused, so the form, the server and the types cannot drift apart.

// Above this an amount is confirmed rather than refused: the largest single payment in the workbooks is a plot at Rs 41,475,000.
export const LARGE_AMOUNT_PAISA = 500_000_000

export const money = z.union([z.string(), z.number()]).transform((value, ctx) => {
  let paisa: number

  try {
    paisa = rupeesToPaisa(value)
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Put in how much was paid, in numbers.' })
    return z.NEVER
  }

  if (paisa === 0) {
    ctx.addIssue({ code: 'custom', message: 'Put in how much was paid.' })
    return z.NEVER
  }

  return paisa
})

export const calendarDay = z.string().transform((value, ctx) => {
  let day: string

  try {
    day = parseCalendarDate(value)
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Pick the day this happened.' })
    return z.NEVER
  }

  if (!notInTheFuture(day)) {
    ctx.addIssue({ code: 'custom', message: 'Pick a day that has already happened.' })
    return z.NEVER
  }

  return day
})

export const personName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length >= 2 && value.length <= 80, {
    message: 'Put in the name of the person or shop paid.',
  })

// Written five different ways across the workbooks, so every one of them is normalised rather than refused.
export const pakistaniMobile = z
  .string()
  .transform((value) => value.replace(/\D/g, '').replace(/^92/, '0'))
  .refine((digits) => /^03\d{9}$/.test(digits), {
    message: 'Put in a mobile number, like 0321-4276376.',
  })
  .transform((digits) => `${digits.slice(0, 4)}-${digits.slice(4)}`)

export const chequeNumber = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length >= 1 && value.length <= 20, {
    message: 'Put in the number written on the cheque.',
  })

export const note = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length <= 300, {
    message: 'Keep the note shorter.',
  })
