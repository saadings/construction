import type { WebhookEvent } from '@clerk/backend'
import { type FunctionReference, getFunctionName } from 'convex/server'
import { describe, expect, it } from 'vitest'

import type { ActionCtx } from '../_generated/server'
import { handleClerkEvent } from './clerk'

interface MutationCall {
  name: string
  args: unknown
}

/**
 * Stands in for the action context and records every mutation it is asked to
 * run. The real context carries far more than the handler touches, so it is
 * narrowed here rather than built in full.
 */
function recordingCtx() {
  const calls: MutationCall[] = []

  const ctx = {
    runMutation: (reference: FunctionReference<'mutation'>, args: unknown) => {
      calls.push({ name: getFunctionName(reference), args })
      return Promise.resolve()
    },
  } as unknown as ActionCtx

  return { ctx, calls }
}

/** Clerk sends much more than the handler reads; only what it reads is built. */
function webhookEvent(type: WebhookEvent['type'], data: Record<string, unknown>): WebhookEvent {
  return { type, data } as unknown as WebhookEvent
}

describe('clerk webhook', () => {
  it('ignores organisation events instead of throwing', async () => {
    const { ctx, calls } = recordingCtx()

    await handleClerkEvent(ctx, webhookEvent('organization.created', { id: 'org_1' }))

    expect(calls).toEqual([])
  })

  it('still handles user.created', async () => {
    const { ctx, calls } = recordingCtx()
    const data = {
      id: 'user_1',
      first_name: 'Nauman',
      last_name: 'Saeed',
      email_addresses: [{ id: 'e1', email_address: 'n@example.com' }],
      primary_email_address_id: 'e1',
    }

    await handleClerkEvent(ctx, webhookEvent('user.created', data))

    expect(calls).toEqual([{ name: 'users/actions:upsert', args: { data } }])
  })

  it('still handles user.deleted', async () => {
    const { ctx, calls } = recordingCtx()

    await handleClerkEvent(ctx, webhookEvent('user.deleted', { id: 'user_1' }))

    expect(calls).toEqual([{ name: 'users/actions:remove', args: { clerkUserId: 'user_1' } }])
  })
})
