import { z } from 'zod'

import { boundedText, calendarDay } from './primitives'

// A house is spoken about by its address, so that is the name: "1-A, Phase 0".
export const siteName = boundedText({
  atLeast: 2,
  atMost: 80,
  tooShort: 'Give this site a name, the way you say it: 1-A, Phase 0.',
  tooLong: 'Keep the name shorter, the way you would say it out loud.',
})

// Plot number, block, phase and scheme are all written the way DHA writes them, so they are kept as typed and only bounded.
export const addressPart = boundedText({
  atLeast: 1,
  atMost: 40,
  tooShort: 'Put this in the way it is written on the papers, or leave it empty.',
  tooLong: 'Keep this short, the way it is written on the papers.',
})

// Between 100 and 20,000 square feet, which is the spec's bound and a tighter one than "positive": the largest house in the workbooks is a little over 10,000, and a figure below 100 is a hand slipping off the keypad rather than a house.
export const SMALLEST_HOUSE_SQFT = 100
export const LARGEST_HOUSE_SQFT = 20_000

export const coveredArea = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const sqft = Number(String(value).replaceAll(',', '').trim())

  // Three different mistakes, three sentences. One message for all of them told whoever typed 50 that he had not put in square feet, when he had.
  if (!Number.isFinite(sqft) || String(value).trim() === '') {
    ctx.addIssue({ code: 'custom', message: 'Put in the covered area in figures, like 4,975.' })
    return z.NEVER
  }

  if (sqft < SMALLEST_HOUSE_SQFT) {
    ctx.addIssue({
      code: 'custom',
      message: `That is too small for a house. The least this takes is ${SMALLEST_HOUSE_SQFT} square feet.`,
    })
    return z.NEVER
  }

  if (sqft > LARGEST_HOUSE_SQFT) {
    ctx.addIssue({
      code: 'custom',
      message: `That is larger than any house here. The biggest in ten years is a little over 10,000, and the most this takes is ${LARGEST_HOUSE_SQFT.toLocaleString('en-US')} square feet.`,
    })
    return z.NEVER
  }

  return Math.round(sqft)
})

// A keyboard hint opens a phone on digits and does nothing at all on a desktop, which is how `Alasdfas` got into a covered area. The field takes figures as they are typed and lets nothing else in, so it can never hold what it will only refuse later.

// Commas stay, because that is how the figure is written: 4,975.
export function areaWhileTyping(typed: string): string {
  return typed.replace(/[^\d,]/g, '')
}

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
