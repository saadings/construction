import { z } from 'zod'

import { boundedText } from './primitives'

// What money is spent on. Nauman asked for this first: "Will there be system settings where we are able to add multiple things like what for, who was paid (contractor), etc etc?"
export const tradeName = boundedText({
  atLeast: 2,
  atMost: 60,
  tooShort: 'Say what the money is spent on, the way you say it on site.',
  tooLong: 'Keep it short enough to pick from a list.',
})

export const tradeInput = z.object({
  name: tradeName,
  // Not a detail: the true ones added together are what a house cost. Buying the land is money spent and is not building.
  countsAsBuildingCost: z.boolean(),
})

// Two rows for one trade split a house's spending across both, and the building cost is then wrong and quietly so. Compared the way a person compares it: case is not a different trade, and neither is the spacing.
export function sameTrade(one: string, other: string): boolean {
  return one.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === other.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

// Said with the name in it, because "already exists" leaves somebody looking down a list of forty-five to work out which one.
export function sayTheTradeIsThere(name: string): string {
  return `${name} is already on the list.`
}
