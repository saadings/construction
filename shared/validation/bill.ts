import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { namesSomebody, whoWasNamed } from './person'
import { calendarDay, money, note } from './primitives'

// What a person is owed, as it is typed. Nothing here is asked of a payment: most spending never has a bill, and asking for one before money can go out would be a worse Excel.
export const SAY_BILL = {
  who: 'Say who has billed us.',
} as const

export const billInput = z
  .object({
    // One form on the house raises a bill and agrees an engagement from the same picker, so a name typed for one has to work for the other. Without this the offer appears and the send is refused, which is worse than not offering it.
    ...whoWasNamed,
    tradeId: zid('trades'),
    day: calendarDay,
    amount: money,
    // Their own number on the bill or challan, kept as written.
    reference: z.string().trim().max(40).optional(),
    description: note.optional(),
  })
  .refine(namesSomebody, {
    path: ['personId'],
    message: SAY_BILL.who,
  })

// A lump sum, or a rate against a unit. One or the other, because an engagement that says neither records nothing at all.
export const SAY_ENGAGEMENT = {
  who: 'Say who is on this trade.',
} as const

export const engagementInput = z
  .object({
    // Picked, or typed: a mason turning up on a house nobody has written down yet is the ordinary case, not the exception.
    ...whoWasNamed,
    tradeId: zid('trades'),
    agreed: money.optional(),
    rate: money.optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    note: note.optional(),
  })
  .refine(namesSomebody, {
    path: ['personId'],
    message: SAY_ENGAGEMENT.who,
  })
  .refine((engagement) => engagement.agreed !== undefined || engagement.rate !== undefined, {
    path: ['agreed'],
    message: 'Put in what was agreed, either a whole figure or a rate.',
  })
  .refine((engagement) => engagement.rate === undefined || !!engagement.unit, {
    path: ['unit'],
    message: 'Say what the rate is for, like a square foot or a load.',
  })
