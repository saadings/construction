import { z } from 'zod'

export const bankAccountLabel = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length >= 2 && value.length <= 40, {
    message: 'Name this account the way you say it: the bank, then its last four figures.',
  })

// The whole number is typed and only its last four digits are kept. Nothing downstream has to remember to hide the rest, because the rest was never stored.
export const lastFourOf = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length >= 4, {
    message: 'Put in the account number, or at least its last four digits.',
  })
  .transform((digits) => digits.slice(-4))

export const bankAccountInput = z.object({
  label: bankAccountLabel,
  number: lastFourOf,
})
