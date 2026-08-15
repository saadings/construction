import { ConvexError, v } from 'convex/values'

import { emailToInvite } from '../../shared/validation/invite'
import { authenticatedAction } from '../utils/auth'
import { checked } from '../utils/checked'

// Somebody is let in by being invited, and by nothing else. Clerk sends the email, takes the sign-up and tells the webhook; there is no invitation of our own to keep in step with theirs.

// Every call is from here rather than from a screen, because the key that makes them work would be in the bundle of anything a browser runs, and a key in a bundle is a key anybody has.
const CLERK = 'https://api.clerk.com/v1'

type Invitation = { id: string; email_address: string; created_at: number; status: string }

// What a screen is given: who was asked, and when. No token, no link, nothing that would let anyone but the person emailed use it.
export type Invited = { id: string; email: string; askedOn: number }

function theKey(): string {
  const key = process.env.CLERK_SECRET_KEY

  // Not a mistake anybody using the app can make or fix, so it says which of the two it is rather than reading as a refusal aimed at them.
  if (key === undefined || key === '') {
    throw new ConvexError('Inviting is not switched on yet. Whoever set this up needs to finish it.')
  }

  return key
}

async function askClerk(path: string, how: { method: string; body?: unknown }): Promise<unknown> {
  const answer = await fetch(`${CLERK}${path}`, {
    method: how.method,
    headers: {
      Authorization: `Bearer ${theKey()}`,
      'Content-Type': 'application/json',
    },
    body: how.body === undefined ? undefined : JSON.stringify(how.body),
  })

  if (!answer.ok) {
    // Clerk's own words are for us, not for him: they name fields and identifiers. What comes back is one sentence about what did not happen.
    console.error(`Clerk said ${answer.status} to ${how.method} ${path}`)
    throw new ConvexError('That did not go through. Try once more in a moment.')
  }

  return await answer.json()
}

function invitationsIn(answer: unknown): Array<Invited> {
  // Clerk answers with a bare array today and has answered with `{ data }` before, so both are read rather than assumed.
  const rows: unknown = Array.isArray(answer) ? answer : ((answer as { data?: unknown }).data ?? [])
  if (!Array.isArray(rows)) {
    return []
  }

  return (rows as Array<Invitation>).map((row) => ({
    id: row.id,
    email: row.email_address,
    askedOn: row.created_at,
  }))
}

// Everyone asked in who has not signed up yet. Somebody who has is not on this list at all: they are an account, which is a different question.
export const whoIsWaiting = authenticatedAction({
  handler: async (): Promise<Array<Invited>> => {
    const answer = await askClerk('/invitations?status=pending&limit=100', { method: 'GET' })

    return invitationsIn(answer).sort((one, other) => other.askedOn - one.askedOn)
  },
})

export const invite = authenticatedAction({
  args: { email: v.string() },
  handler: async (_ctx, args): Promise<Invited> => {
    const email = checked(emailToInvite, args.email)

    const answer = await askClerk('/invitations', {
      method: 'POST',
      // Clerk emails them and takes the sign-up. Nothing waits here for anybody to approve afterwards.
      body: { email_address: email, notify: true },
    })

    const [invited] = invitationsIn([answer])
    if (invited === undefined) {
      throw new ConvexError('That did not go through. Try once more in a moment.')
    }

    return invited
  },
})

// Taken off before they have used it. Once somebody has signed up there is nothing here to take off, which is why this cannot lock anybody out by mistake.
export const takeOff = authenticatedAction({
  args: { id: v.string() },
  handler: async (_ctx, args): Promise<null> => {
    await askClerk(`/invitations/${encodeURIComponent(args.id)}/revoke`, { method: 'POST' })

    return null
  },
})
