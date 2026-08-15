import { z } from 'zod'

import { boundedText } from './primitives'

export const bankAccountLabel = boundedText({
  atLeast: 2,
  atMost: 40,
  tooShort: 'Name this account the way you say it: the bank, then its last four figures.',
  tooLong: 'Keep the name shorter: the bank, then its last four figures.',
})

// Applied on the device, where the whole number is typed. Its last four digits are all that is sent, so the rest never crosses the wire and there is nothing anywhere else to store or log.
export const lastFourOf = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .superRefine((digits, ctx) => {
    // Nothing typed and a number half typed are different mistakes: one is a field not filled in, the other is a hand that stopped.
    if (digits.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Put in the account number.' })
    } else if (digits.length < 4) {
      ctx.addIssue({
        code: 'custom',
        message: 'That is not enough of it. Put in the whole number, or its last four digits.',
      })
    }
  })
  .transform((digits) => digits.slice(-4))

// Typed on the screen. This shape never reaches the server.
export const bankAccountTyped = z.object({
  label: bankAccountLabel,
  number: lastFourOf,
})

// What the server is handed and checks again, because a caller is never the authority on what it sent.
export const bankAccountArriving = z.object({
  label: bankAccountLabel,
  lastFourDigits: z
    .string()
    .refine((digits) => /^\d{4}$/.test(digits), { message: 'That is not the last four figures of an account.' }),
})
