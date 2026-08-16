import { z } from 'zod'

// The words themselves, once, so a refusal reads the same whether it was caught as it was typed or when it reached the server.
export const SAY_INVITE = {
  email: 'Put in the email address to send it to.',
  notAnEmail: 'That does not look like an email address.',
} as const

// What somebody is told when Clerk refuses. Here rather than beside the action, for the same reason as everything above it: the screen falls back to the last of these when nothing readable was thrown at all, so the two would otherwise be one sentence written twice and free to drift.

// Clerk's own words never reach a screen. They are written for developers, they name fields and identifiers, and they quote the address back. Their body is evidence; these are the copy.
export const SAY_CLERK = {
  already: 'That address has already been invited, or somebody is signed in with it already.',
  tooMany: 'Too many invitations just now. Try again in a few minutes.',
  notSwitchedOn: 'Inviting is not switched on yet. Whoever set this up needs to finish it.',
  // Its own sentence rather than the one above, which sends whoever reads it looking at the key. The key is fine: sign-in is set to Google only, so there is no email sign-in for an invitation to invite anybody to, and Clerk refuses to make one.
  noEmailSignIn:
    'Inviting is not switched on yet. Signing in with an email address has to be turned on first, and whoever set this up can do it.',
  unknown: 'That did not go through. Try once more in a moment.',
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
