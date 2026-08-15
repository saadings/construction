import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { calendarDay, note, positiveMoney } from './primitives'

// A house is between 100 and 20,000 square feet, the same bound a site's covered area is held to.
const areaSqft = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const sqft = Number(String(value).replaceAll(',', '').trim())

  if (!Number.isFinite(sqft) || sqft < 100 || sqft > 20_000) {
    ctx.addIssue({ code: 'custom', message: 'Put in the area in square feet.' })
    return z.NEVER
  }

  return sqft
})

// Priced one way or the other. A lump sum carries no rate and a rate carries no total, so neither can be left behind when the other changes.
const priced = z.discriminatedUnion('how', [
  z.object({ how: z.literal('lumpSum'), totalPaisa: positiveMoney }),
  z.object({ how: z.literal('ratePerSqft'), ratePerSqftPaisa: positiveMoney }),
])

// What may be corrected on a contract already agreed. Its client and the day it was agreed are not here: those are what a disagreement is settled against, and a wrong one is cancelled rather than quietly rewritten.
export const contractRevision = z.object({
  priced,
  agreedAreaSqft: areaSqft,
  note: note.optional(),
})

export const contractInput = z.object({
  clientId: zid('people'),
  agreedOn: calendarDay,
  priced,
  agreedAreaSqft: areaSqft,
  actualAreaSqft: areaSqft.optional(),
  note: note.optional(),
})

export type Contract = {
  priced: { how: 'lumpSum'; totalPaisa: number } | { how: 'ratePerSqft'; ratePerSqftPaisa: number }
  agreedAreaSqft: number
  actualAreaSqft?: number
}

// What was measured if anyone has measured, and what was agreed until they do. The agreed figure is never overwritten, so this is the only place the choice is made.
export function areaThatCounts(contract: Contract): number {
  return contract.actualAreaSqft ?? contract.agreedAreaSqft
}

// Worked out on every read and stored nowhere. A rate contract whose total was written down would keep the old figure the day the house is measured again, which is what the workbooks did.
export function contractValuePaisa(contract: Contract): number {
  if (contract.priced.how === 'lumpSum') {
    return contract.priced.totalPaisa
  }

  // Rounded once, here, because a rate against a fractional area is not a whole number of paisa and money is only ever whole paisa.
  return Math.round(contract.priced.ratePerSqftPaisa * areaThatCounts(contract))
}
