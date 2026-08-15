import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import type { HowPaid } from './howMoneyMoved'
import { HOW_PAID, asksForBank, asksForChequeNumber } from './howMoneyMoved'
import { calendarDay, chequeNumber, money, note, personName } from './primitives'

// The words themselves, once, so a refusal reads the same whether it was caught as it was typed or when it reached the server.
export const SAY = {
  trade: 'Pick what this was for.',
  paidTo: 'Say who was paid.',
  amount: 'Put in how much was paid.',
  paidBy: 'Say whose money this was.',
  reference: 'Add the cheque number.',
  bank: 'Say which account this left.',
  nothing: 'Put in at least one payment.',
} as const

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
    method: z.enum(HOW_PAID),
    reference: chequeNumber.optional(),
    bankAccountId: zid('bankAccounts').optional(),
    note: note.optional(),
    isExtraWork: z.boolean().default(false),
  })
  .refine((entry) => !asksForChequeNumber(entry.method) || !!entry.reference, {
    path: ['reference'],
    message: SAY.reference,
  })
  .refine((entry) => !asksForBank(entry.method) || !!entry.bankAccountId, {
    path: ['bankAccountId'],
    message: SAY.bank,
  })
  .refine((entry) => !!entry.paidToId || !!entry.newPerson, {
    path: ['paidToId'],
    message: SAY.paidTo,
  })

// A sitting: one cheque run on a Tuesday touching eight trades. All of them or none, so there are no half-saved days.
export const daySheet = z.array(paymentEntry).min(1, { message: SAY.nothing })

// What a payment looks like while it is being typed: every answer a string, because that is what a half-filled form holds.
export type BeingTyped = {
  tradeId: string
  paidToId: string
  newPerson: string
  amount: string
  paidById: string
  method: HowPaid
  reference: string
  bankAccountId: string
  note: string
}

// Asked by the screen as it is typed, answered from the same rules the schema refuses by, so the two cannot drift into disagreeing.

// Never more than the first thing wrong, because eight problems at once reads as the app being broken rather than as a question unanswered.
export function whatIsMissing(typed: BeingTyped): string | null {
  if (!typed.tradeId) return SAY.trade
  if (!typed.paidToId && !typed.newPerson.trim()) return SAY.paidTo
  if (!isAnAmount(typed.amount)) return SAY.amount
  if (!typed.paidById) return SAY.paidBy
  if (asksForChequeNumber(typed.method) && !typed.reference.trim()) return SAY.reference
  if (asksForBank(typed.method) && !typed.bankAccountId) return SAY.bank

  return null
}

function isAnAmount(typed: string): boolean {
  return money.safeParse(typed).success
}
