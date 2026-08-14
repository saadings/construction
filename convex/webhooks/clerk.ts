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
      const clerkUserId = event.data.id!
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
  const event = await validateRequest(request)
  if (!event) {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  await handleClerkEvent(ctx, event)

  return new Response(null, { status: 200 })
})
