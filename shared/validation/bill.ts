import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { calendarDay, money, note } from './primitives'

// What a person is owed, as it is typed. Nothing here is asked of a payment: most spending never has a bill, and asking for one before money can go out would be a worse Excel.
export const billInput = z.object({
  personId: zid('people'),
  tradeId: zid('trades'),
  day: calendarDay,
  amount: money,
  // Their own number on the bill or challan, kept as written.
  reference: z.string().trim().max(40).optional(),
  description: note.optional(),
})

// A lump sum, or a rate against a unit. One or the other, because an engagement that says neither records nothing at all.
export const engagementInput = z
  .object({
    personId: zid('people'),
    tradeId: zid('trades'),
    agreed: money.optional(),
    rate: money.optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    note: note.optional(),
  })
  .refine((engagement) => engagement.agreed !== undefined || engagement.rate !== undefined, {
    path: ['agreed'],
    message: 'Put in what was agreed, either a whole figure or a rate.',
  })
  .refine((engagement) => engagement.rate === undefined || !!engagement.unit, {
    path: ['unit'],
    message: 'Say what the rate is for, like a square foot or a load.',
  })
