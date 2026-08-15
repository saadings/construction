import { z } from 'zod'

import { calendarDay, note, positiveMoney } from './primitives'

const description = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length >= 2 && value.length <= 200, {
    message: 'Say what this was for, the way you would say it to him.',
  })

const quantity = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const measured = Number(String(value).replaceAll(',', '').trim())

  if (!Number.isFinite(measured) || measured <= 0) {
    ctx.addIssue({ code: 'custom', message: 'Put in how much of it there was.' })
    return z.NEVER
  }

  return measured
})

const unit = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length >= 1 && value.length <= 20, { message: 'Say what it is measured in.' })

export const extraWorkBillInput = z.object({
  raisedOn: calendarDay,
  description,
  note: note.optional(),
})

export const extraWorkLineInput = z.object({
  description,
  // Left exactly as written. `39.75' x 0.375' x 11'` is how the man on site worked it out, and re-deriving it would only ever disagree with him.
  working: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= 120, { message: 'Keep the working short enough to read on a phone.' })
    .optional(),
  quantity,
  unit,
  // A rate cannot be less than nothing: a line at a negative rate would reduce what the client owes, on a bill raised to charge him more.
  ratePaisa: positiveMoney,
})

export type BillLine = { quantity: number; ratePaisa: number }

// A line comes to its quantity times its rate, rounded once because that is the figure billed on that line.
export function lineAmountPaisa(line: BillLine): number {
  return Math.round(line.quantity * line.ratePaisa)
}

// The bill is its lines added up and is stored nowhere. A total written down is the figure that stays behind when a line is corrected.
export function billTotalPaisa(lines: Array<BillLine>): number {
  return lines.reduce((total, line) => total + lineAmountPaisa(line), 0)
}
