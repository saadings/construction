import { z } from 'zod'

import { calendarDay, percent } from './primitives'

export const milestoneInput = z.object({
  description: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .refine((value) => value.length >= 2 && value.length <= 120, {
      message: 'Say what this stage is, the way it reads on the contract.',
    }),
  percent,
  billedOn: calendarDay.optional(),
})

// Rounded per stage, because that is what is billed: a stage is raised on its own and the figure on that bill is the one that has to be a whole number of paisa.
export function milestoneAmountPaisa(contractValuePaisa: number, percent: number): number {
  return Math.round((contractValuePaisa * percent) / 100)
}

// What the stages add up to. Shown rather than enforced: a re-measurement or a stage nobody planned leaves real contracts adding to something other than a hundred, and refusing those would refuse the truth.
export function percentAgreedSoFar(milestones: Array<{ percent: number }>): number {
  return Math.round(milestones.reduce((total, one) => total + one.percent, 0) * 100) / 100
}
