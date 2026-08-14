import type { WebhookEvent } from '@clerk/backend'

import { internal } from '../_generated/api'
import { type ActionCtx, httpAction } from '../_generated/server'
import { validateRequest } from '../utils/validateRequest'

export async function handleClerkEvent(ctx: ActionCtx, event: WebhookEvent) {
  switch (event.type) {
    case 'user.created':
    // intentional fallthrough
    case 'user.updated':
      await ctx.runMutation(internal.users.actions.upsert, {
        data: event.data,
      })
      break

    case 'user.deleted': {
      const clerkUserId = event.data.id
      if (clerkUserId === undefined) {
        // Clerk marks the id optional on a deleted object, so this is possible
        // rather than merely conceivable. There is no one to remove without it,
        // and a failure here would only have Clerk sending the same unusable
        // message back for days.
        console.warn('Ignored a Clerk user.deleted event that named no one')
        break
      }

      await ctx.runMutation(internal.users.actions.remove, {
        clerkUserId,
      })
      break
    }

    default:
      // Organisation events land here. This app grants access through site
      // roles, so there is nothing to mirror.
      console.log('Ignored Clerk webhook event', event.type)
  }
}

export const clerkUsersWebhook = httpAction(async (ctx: ActionCtx, request: Request) => {
  const checked = await validateRequest(request)

  switch (checked.outcome) {
    case 'notFromClerk':
      // Clerk drops a 4xx. Nothing about this message would pass on a second
      // attempt, so asking for one only fills the delivery log.
      return new Response('Invalid webhook signature', { status: 400 })

    case 'nothingToCheckAgainst':
      // Deliberately a 5xx, which Clerk redelivers with backoff. The signing
      // secret is missing from this deployment, not from the message, so the
      // retries land the sign-ups that would otherwise be lost outright once
      // someone sets it.
      console.error(
        'Turned away a Clerk webhook because this deployment has no usable CLERK_WEBHOOK_SECRET. ' +
          'Set it to the signing secret Clerk showed when the endpoint was created.'
      )
      return new Response('This deployment cannot check webhooks yet', { status: 500 })

    case 'fromClerk':
      await handleClerkEvent(ctx, checked.event)
      return new Response(null, { status: 200 })
  }
})
