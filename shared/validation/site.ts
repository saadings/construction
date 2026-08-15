import { z } from 'zod'

import { calendarDay } from './primitives'

// A house is spoken about by its address, so that is the name: "1-A, Phase 0".
export const siteName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length >= 2 && value.length <= 80, {
    message: 'Give this site a name, the way you say it: 1-A, Phase 0.',
  })

// Plot number, block, phase and scheme are all written the way DHA writes them, so they are kept as typed and only bounded.
export const addressPart = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length >= 1 && value.length <= 40, {
    message: 'Keep this short, the way it is written on the papers.',
  })

// Between 100 and 20,000 square feet, which is the spec's bound and a tighter one than "positive": the largest house in the workbooks is a little over 10,000, and a figure below 100 is a hand slipping off the keypad rather than a house.
export const coveredArea = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const sqft = Number(String(value).replaceAll(',', '').trim())

  if (!Number.isFinite(sqft) || sqft < 100 || sqft > 20_000) {
    ctx.addIssue({ code: 'custom', message: 'Put in the covered area in square feet.' })
    return z.NEVER
  }

  return Math.round(sqft)
})

export const siteStage = z.enum(['planning', 'building', 'finishing', 'complete', 'sold'])

// Whether the partners own this plot or are building it for someone. It decides whether the site shows a sale or a bill, and nothing else does.
export const siteInput = z.object({
  name: siteName,
  plotNumber: addressPart.optional(),
  block: addressPart.optional(),
  phase: addressPart.optional(),
  scheme: addressPart.optional(),
  coveredAreaSqft: coveredArea.optional(),
  startedOn: calendarDay.optional(),
  builtForAClient: z.boolean(),
  stage: siteStage,
})
