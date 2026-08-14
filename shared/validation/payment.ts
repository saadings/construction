import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { calendarDay, chequeNumber, money, note, personName } from './primitives'

// One filled amount cell in the workbooks is one of these. The site is not here: it comes from the wrapper that already checked the caller may reach it.
export const paymentEntry = z
  .object({
    tradeId: zid('trades'),
    day: calendarDay,
    amount: money,
    // Either someone already known, or a name typed once for a shop nobody will pay again.
    paidToId: zid('people').optional(),
    newPerson: personName.optional(),
    // Whose money it was. This is the partner split, and it is why two parallel ledgers on one house cannot happen again.
    paidById: zid('people'),
    method: z.enum(['cheque', 'cash', 'transfer', 'payOrder']),
    // Asked for on cheques only. A pay order carries a number too, but requiring it would block a real payment and costs nothing to leave open.
    reference: chequeNumber.optional(),
    bankAccountId: zid('bankAccounts').optional(),
    note: note.optional(),
    isExtraWork: z.boolean().default(false),
  })
  .refine((entry) => entry.method !== 'cheque' || !!entry.reference, {
    path: ['reference'],
    message: 'Add the cheque number.',
  })
  // Cheque and transfer only. A pay order can be bought over the counter with cash, so it may have no account behind it and asking for one would refuse a payment that really happened.
  .refine((entry) => (entry.method !== 'cheque' && entry.method !== 'transfer') || !!entry.bankAccountId, {
    path: ['bankAccountId'],
    message: 'Say which account this left.',
  })
  .refine((entry) => !!entry.paidToId || !!entry.newPerson, {
    path: ['paidToId'],
    message: 'Say who was paid.',
  })

// A sitting: one cheque run on a Tuesday touching eight trades. All of them or none, so there are no half-saved days.
export const daySheet = z.array(paymentEntry).min(1, { message: 'Put in at least one payment.' })
