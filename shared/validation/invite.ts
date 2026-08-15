import { z } from 'zod'

// The words themselves, once, so a refusal reads the same whether it was caught as it was typed or when it reached the server.
export const SAY_INVITE = {
  email: 'Put in the email address to send it to.',
  notAnEmail: 'That does not look like an email address.',
} as const

// Lowercased and trimmed, because an address typed with a capital is the same address and Clerk will not treat it as one.
export const emailToInvite = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .superRefine((value, ctx) => {
    if (value === '') {
      ctx.addIssue({ code: 'custom', message: SAY_INVITE.email })
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: SAY_INVITE.notAnEmail })
    }
  })
