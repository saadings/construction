// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { Webhook } from 'svix'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../_generated/api'
import schema from '../schema'

// The webhook as Clerk meets it — signed request, status code, table contents — never through which internal mutation ran.

// Assembled, never written out, so this file holds no string shaped like a real signing secret for the hygiene scan to flag.
const SIGNING_SECRET = `whsec_${btoa('construction scenario tests')}`

function clerkRequest(event: unknown, options: { secret?: string; signed?: boolean } = {}): RequestInit {
  const { secret = SIGNING_SECRET, signed = true } = options
  const body = JSON.stringify(event)

  if (!signed) {
    return { method: 'POST', headers: { 'content-type': 'application/json' }, body }
  }

  const messageId = 'msg_scenario'
  const sentAt = new Date()

  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': messageId,
      'svix-timestamp': String(Math.floor(sentAt.getTime() / 1000)),
      'svix-signature': new Webhook(secret).sign(messageId, sentAt, body),
    },
    body,
  }
}

function convexWithClerkWebhook() {
  return convexTest(schema, import.meta.glob('../**/*.*s'))
}

/** A user event carrying only the parts the handler reads. */
function userEvent(type: 'user.created' | 'user.updated', id: string, surname = 'Saeed') {
  return {
    type,
    data: {
      id,
      first_name: 'Nauman',
      last_name: surname,
      email_addresses: [{ id: 'e1', email_address: 'nauman@example.com' }],
      primary_email_address_id: 'e1',
    },
  }
}

function userCreated(id: string) {
  return userEvent('user.created', id)
}

beforeEach(() => {
  vi.stubEnv('CLERK_WEBHOOK_SECRET', SIGNING_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('events this app has no use for', () => {
  it('accepts an organisation event so Clerk stops sending it', async () => {
    const t = convexWithClerkWebhook()

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest({ type: 'organization.created', data: { id: 'org_1' } })
    )

    expect(response.status).toBe(200)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })

  it('accepts a membership event, which Clerk sends whenever anyone joins anything', async () => {
    const t = convexWithClerkWebhook()

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest({ type: 'organizationMembership.created', data: { id: 'orgmem_1' } })
    )

    expect(response.status).toBe(200)
  })

  it('accepts an event type it has never heard of', async () => {
    // Clerk adds event types over time, and an unfamiliar name is not an emergency.
    const t = convexWithClerkWebhook()

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest({ type: 'waitlistEntry.created', data: { id: 'wl_1' } })
    )

    expect(response.status).toBe(200)
  })
})

describe('payloads that are not what they claim to be', () => {
  it('turns away a request carrying no signature at all', async () => {
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_forged'), { signed: false }))

    // 400 specifically: a 200 mirrors a forged user, a 500 has the sender retrying for days over something that cannot succeed.
    expect(response.status).toBe(400)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })

  it('turns away a request signed with the wrong secret', async () => {
    const t = convexWithClerkWebhook()

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest(userCreated('user_forged'), { secret: `whsec_${btoa('some other project')}` })
    )

    expect(response.status).toBe(400)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })

  it('accepts a deletion for a person it never held', async () => {
    // Ordinary — an account deleted before the webhook was wired up, or a redelivery — and nothing to remove is not a failure.
    const t = convexWithClerkWebhook()

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest({ type: 'user.deleted', data: { id: 'user_never_seen' } })
    )

    expect(response.status).toBe(200)
  })

  it('accepts a deletion that arrives with no one named in it', async () => {
    // Clerk marks the id optional on a deleted object; asserting it was there answered 500 to a message that could never succeed.
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest({ type: 'user.deleted', data: {} }))

    expect(response.status).toBe(200)
  })
})

describe('a deployment that cannot check anything yet', () => {
  it('asks Clerk to come back when no signing secret is set, rather than crashing', async () => {
    // There is a window where the signing secret is not set at all, and svix throws from its constructor on an empty one.
    vi.stubEnv('CLERK_WEBHOOK_SECRET', undefined)
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_before_setup')))

    // 5xx on purpose — the message is fine, the deployment is not — so Clerk redelivers and the sign-up lands once the secret is set.
    expect(response.status).toBe(500)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })

  it('does the same for a signing secret that is set but unreadable', async () => {
    // A truncated value fails inside svix's base64 decoding, a different throw from the empty one that took the same route out.
    vi.stubEnv('CLERK_WEBHOOK_SECRET', 'whsec_not base64 at all')
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_bad_secret')))

    expect(response.status).toBe(500)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })
})

describe('the control', () => {
  it('lets a real user through, so the empty tables above mean something', async () => {
    // Every assertion that nothing happened is worthless if nothing can happen; this is the one proving the pipeline works.
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_control')))

    expect(response.status).toBe(200)

    const users = await t.run((ctx) => ctx.db.query('users').collect())
    expect(users.map((user) => user.externalId)).toEqual(['user_control'])
  })
})

describe('someone the app already holds', () => {
  it('is updated in place when their details change, not added a second time', async () => {
    // Fails here and nowhere else if the `user.updated` fallthrough label is tidied away, or if the mirror inserts instead of patching.
    const t = convexWithClerkWebhook()
    await t.fetch('/webhooks/clerk', clerkRequest(userEvent('user.created', 'user_nauman')))

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userEvent('user.updated', 'user_nauman', 'Ahmed')))

    expect(response.status).toBe(200)

    // One person, carrying the new name.
    const users = await t.run((ctx) => ctx.db.query('users').collect())
    expect(users.map((user) => user.name)).toEqual(['Nauman Ahmed'])

    // And the app can still say who he is: a second row makes this throw rather than answer.
    const signedInAsNauman = t.withIdentity({ subject: 'user_nauman' })
    expect(await signedInAsNauman.query(api.users.actions.current, {})).toMatchObject({ name: 'Nauman Ahmed' })
  })

  it('is let go when their Clerk account is deleted', async () => {
    // The two deletion tests above name nobody and a stranger, so neither ever reaches the removal itself.
    const t = convexWithClerkWebhook()
    await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_departed')))

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest({ type: 'user.deleted', data: { id: 'user_departed' } })
    )

    expect(response.status).toBe(200)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })
})
