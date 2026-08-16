import { z } from 'zod'

import { namesSomebody, whoWasNamed } from './person'
import { calendarDay, note, positiveMoney } from './primitives'

// A house is between 100 and 20,000 square feet, the same bound a site's covered area is held to.

// Exported so the screen asking for it can hold one answer to the same rule the server refuses by, rather than a second rule written to look like it.
export const areaSqft = z.union([z.string(), z.number()]).transform((value, ctx) => {
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

export const SAY_CONTRACT = {
  client: 'Say who the house is being built for.',
} as const

// The shape without the "somebody has to be named" rule on it, because two callers want a piece of it rather than the whole: `measure` picks the measured area out, and zod cannot pick through a refinement.
const contractTyped = z.object({
  // Picked, or typed. A client is written down once, at the moment the contract is agreed, so sending somebody to the people screen first is sending them away at exactly the wrong moment.
  ...whoWasNamed,
  agreedOn: calendarDay,
  priced,
  agreedAreaSqft: areaSqft,
  actualAreaSqft: areaSqft.optional(),
  note: note.optional(),
})

export const contractInput = contractTyped.refine(namesSomebody, {
  path: ['personId'],
  message: SAY_CONTRACT.client,
})

/** Only the measured area, which is the one thing `measure` may move. Picked from the shape above so it cannot drift from what a contract is. */
export const contractMeasured = contractTyped.pick({ actualAreaSqft: true })

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
