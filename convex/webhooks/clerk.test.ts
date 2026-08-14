// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { Webhook } from 'svix'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../_generated/api'
import schema from '../schema'

/**
 * The Clerk webhook as Clerk actually meets it: a signed HTTP request arriving
 * at `/webhooks/clerk`, through signature validation, the router and the
 * handler, ending in a status code and whatever it left behind in `users`.
 *
 * The status code is half the point. Clerk reads it to decide what to do next:
 *
 *   - 2xx — delivered, forget it
 *   - anything else — retry, with backoff, for days
 *
 * So an event this app has no interest in must still be answered with a 200.
 * A handler that throws on one turns a single organisation event into an
 * endless stream of redeliveries, and this app deleted the organisation tables
 * precisely so it would never look at those events again.
 *
 * The other half is which person the app ends up holding. Everything is
 * asserted through what came back and what is in the table, never through
 * which internal mutation happened to be called — that wiring is free to
 * change, and the behaviour here is not.
 */

/**
 * Assembled rather than written out, so this file never contains a string
 * shaped like a real signing secret — the repository-hygiene scan reads git
 * history for exactly that shape and would be right to flag it.
 */
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
    // Clerk adds event types over time, and an endpoint subscribed by mistake
    // receives them without warning. An unfamiliar name is not an emergency.
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

    // 400, specifically. A 200 would mirror a forged user into the app, and a
    // 500 would have the sender trying again for days over something that can
    // never succeed.
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
    // Ordinary: a Clerk account deleted before the webhook was wired up, or a
    // redelivery of one already handled. Nothing to remove is not a failure.
    const t = convexWithClerkWebhook()

    const response = await t.fetch(
      '/webhooks/clerk',
      clerkRequest({ type: 'user.deleted', data: { id: 'user_never_seen' } })
    )

    expect(response.status).toBe(200)
  })

  it('accepts a deletion that arrives with no one named in it', async () => {
    // Clerk marks the id optional on a deleted object. The handler used to
    // assert it was there, so this payload reached a mutation that requires a
    // string, threw, and answered 500 — to a message that would never succeed
    // however many times Clerk sent it back.
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest({ type: 'user.deleted', data: {} }))

    expect(response.status).toBe(200)
  })
})

describe('a deployment that cannot check anything yet', () => {
  it('asks Clerk to come back when no signing secret is set, rather than crashing', async () => {
    // The signing secret is set on the deployment by hand and by CI, so there
    // is a window where it is not there at all. Svix throws from its
    // constructor on an empty secret, and that throw used to travel straight
    // out of the handler.
    vi.stubEnv('CLERK_WEBHOOK_SECRET', undefined)
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_before_setup')))

    // 5xx on purpose: this message is fine, the deployment is not. Clerk
    // redelivers, so the sign-up lands once the secret is set instead of being
    // lost outright.
    expect(response.status).toBe(500)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })

  it('does the same for a signing secret that is set but unreadable', async () => {
    // A truncated or mistyped value fails inside svix's base64 decoding, which
    // is a different throw from the empty one and took the same route out.
    vi.stubEnv('CLERK_WEBHOOK_SECRET', 'whsec_not base64 at all')
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_bad_secret')))

    expect(response.status).toBe(500)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })
})

describe('the control', () => {
  it('lets a real user through, so the empty tables above mean something', async () => {
    // Every assertion that nothing happened is worthless if nothing can happen.
    // This is the one test here that proves the pipeline works at all.
    const t = convexWithClerkWebhook()

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userCreated('user_control')))

    expect(response.status).toBe(200)

    const users = await t.run((ctx) => ctx.db.query('users').collect())
    expect(users.map((user) => user.externalId)).toEqual(['user_control'])
  })
})

describe('someone the app already holds', () => {
  it('is updated in place when their details change, not added a second time', async () => {
    // Changing your own name or email in Clerk is ordinary, and it is the only
    // event that ever arrives for someone already on file.
    //
    // Two ways this quietly stops working, both invisible from outside:
    //
    //   - the switch reaches `user.updated` by falling through from
    //     `user.created`. One `break` inserted between them — by a linter fix,
    //     or by anyone who reads a fallthrough as a mistake — sends every
    //     profile change to `default`, where it is logged and dropped.
    //
    //   - the mirror stops matching on `externalId` and inserts instead of
    //     patching. Two rows for one Clerk identity make `.unique()` throw, so
    //     the very next thing that asks who is signed in fails. The person is
    //     locked out of the whole app, and nothing in Clerk looks wrong.
    const t = convexWithClerkWebhook()
    await t.fetch('/webhooks/clerk', clerkRequest(userEvent('user.created', 'user_nauman')))

    const response = await t.fetch('/webhooks/clerk', clerkRequest(userEvent('user.updated', 'user_nauman', 'Ahmed')))

    expect(response.status).toBe(200)

    // One person, carrying the new name.
    const users = await t.run((ctx) => ctx.db.query('users').collect())
    expect(users.map((user) => user.name)).toEqual(['Nauman Ahmed'])

    // And the app can still say who he is. This is the part that actually
    // hurts: a second row makes this throw rather than answer.
    const signedInAsNauman = t.withIdentity({ subject: 'user_nauman' })
    expect(await signedInAsNauman.query(api.users.actions.current, {})).toMatchObject({ name: 'Nauman Ahmed' })
  })

  it('is let go when their Clerk account is deleted', async () => {
    // How a partner who has left is taken off. The two deletion tests above
    // both stop short of a person who is really there — one names nobody, the
    // other names a stranger — so neither ever reaches the removal itself.
    //
    // If it fails, it fails as a 500, and Clerk sends the same deletion back
    // for days while the person stays in everyone's list.
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
