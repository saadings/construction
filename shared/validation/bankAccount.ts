import { z } from 'zod'

export const bankAccountLabel = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length >= 2 && value.length <= 40, {
    message: 'Name this account the way you say it: the bank, then its last four figures.',
  })

// Applied on the device, where the whole number is typed. Its last four digits are all that is sent, so the rest never crosses the wire and there is nothing anywhere else to store or log.
export const lastFourOf = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length >= 4, {
    message: 'Put in the account number, or at least its last four digits.',
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
