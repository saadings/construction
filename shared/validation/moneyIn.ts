import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { HOW_PAID, asksForBank, asksForChequeNumber } from './howMoneyMoved'
import { calendarDay, chequeNumber, money, note, personName } from './primitives'

// Why money arrived, which is not the same question as who sent it: on a house Nauman builds for himself he is partner and client at once, and the role he holds cannot tell his own capital apart from a payment against a bill.
export const WHY_IT_CAME = ['partnerMoney', 'clientPayment', 'sale'] as const
export type WhyItCame = (typeof WHY_IT_CAME)[number]

// The words themselves, once, so a refusal reads the same whether it was caught as it was typed or when it reached the server.
export const SAY_IN = {
  from: 'Say who this came from.',
  nothing: 'Put in at least one way it came in.',
  reference: 'Add the cheque number.',
  bank: 'Say which account this landed in.',
} as const

// One arrival of money. The site is not here: it comes from the wrapper that already checked the caller may reach it.
export const receiptInput = z
  .object({
    day: calendarDay,
    amount: money,
    // Either someone already known, or a name typed once -- a buyer at the sale is nobody in the ledger until the day he pays.
    fromId: zid('people').optional(),
    newPerson: personName.optional(),
    why: z.enum(WHY_IT_CAME),
    method: z.enum(HOW_PAID),
    reference: chequeNumber.optional(),
    // Where it landed, rather than where it left. The question is the same one and it is asked by the same rule.
    bankAccountId: zid('bankAccounts').optional(),
    note: note.optional(),
  })
  .refine((receipt) => !asksForChequeNumber(receipt.method) || !!receipt.reference, {
    path: ['reference'],
    message: SAY_IN.reference,
  })
  .refine((receipt) => !asksForBank(receipt.method) || !!receipt.bankAccountId, {
    path: ['bankAccountId'],
    message: SAY_IN.bank,
  })
  .refine((receipt) => !!receipt.fromId || !!receipt.newPerson, {
    path: ['fromId'],
    message: SAY_IN.from,
  })

// One arrival, settled more than one way: 200,000 by cheque and 100,000 in cash is two rows sharing a day, a person and a reason. Nauman was asked and chose it in these words -- "it saves as one line per method... correcting or removing one part leaves the other standing".

// A list rather than a call each, so a half that is refused takes the other half with it. Two calls put the cheque in the ledger and lose the cash, with nothing on the screen saying which happened.
export const moneyArriving = z.array(receiptInput).min(1, { message: SAY_IN.nothing })
