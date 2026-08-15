import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { THE_WHOLE } from '../profitSplit'
import { HOW_PAID, asksForBank, asksForChequeNumber } from './howMoneyMoved'
import { calendarDay, chequeNumber, money, note } from './primitives'

// The words themselves, once, so a refusal reads the same whether it was caught as it was typed or when it reached the server.
export const SAY_SHARE = {
  aShare: 'Put in a share, like 33.33.',
  tooMuch: 'A share cannot be more than the whole.',
  nothing: 'Say who takes what before agreeing it.',
} as const

// Typed as a percentage, because that is what people say, and kept as basis points, because that is what divides exactly.
export const percentAsBasisPoints = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const typed = Number(String(value).replaceAll(',', '').replace('%', '').trim())

  if (!Number.isFinite(typed) || typed <= 0) {
    ctx.addIssue({ code: 'custom', message: SAY_SHARE.aShare })
    return z.NEVER
  }

  if (typed > 100) {
    ctx.addIssue({ code: 'custom', message: SAY_SHARE.tooMuch })
    return z.NEVER
  }

  // Two decimal places is the whole of it: 33.33% is 3333 basis points, and a third place would be a share nobody could say out loud.
  return Math.round(typed * 100)
})

const oneShare = z.object({ personId: zid('people'), share: percentAsBasisPoints })

// Agreed as a set rather than one at a time. A share is a part of a whole, and a whole that only adds up while somebody is halfway through changing it is a whole nobody can read.
export const sharesAgreed = z.object({
  agreedOn: calendarDay,
  shares: z.array(oneShare).min(1, { message: SAY_SHARE.nothing }),
})

// How far off a set of shares is, in basis points. Positive means they come to less than the whole.
export function shortOfTheWhole(shares: Array<{ share: number }>): number {
  return THE_WHOLE - shares.reduce((sum, one) => sum + one.share, 0)
}

// Said with the house named and the figure in it, because "they must come to 100%" leaves somebody counting by hand to find out which one is wrong.
export function saySharesDoNotAddUp(siteName: string, short: number): string {
  const off = Math.abs(short) / 100
  const way = short > 0 ? 'short of' : 'more than'

  return `Those shares are ${off}% ${way} the whole on ${siteName}. They have to come to 100%.`
}

// A partner taking his share out, which moves the same four ways money always moves and asks the same questions.
export const payoutInput = z
  .object({
    personId: zid('people'),
    day: calendarDay,
    amount: money,
    method: z.enum(HOW_PAID),
    reference: chequeNumber.optional(),
    bankAccountId: zid('bankAccounts').optional(),
    note: note.optional(),
  })
  .refine((payout) => !asksForChequeNumber(payout.method) || !!payout.reference, {
    path: ['reference'],
    message: 'Add the cheque number.',
  })
  .refine((payout) => !asksForBank(payout.method) || !!payout.bankAccountId, {
    path: ['bankAccountId'],
    message: 'Say which account this left.',
  })
