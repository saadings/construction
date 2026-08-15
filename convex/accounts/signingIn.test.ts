// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { Webhook } from 'svix'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../_generated/api'
import schema from '../schema'

// Assembled, never written out, so this file holds no string shaped like a real signing secret.
const SIGNING_SECRET = `whsec_${btoa('construction cold start tests')}`

beforeEach(() => {
  vi.stubEnv('CLERK_WEBHOOK_SECRET', SIGNING_SECRET)
})

// Signed the way Clerk signs it, so this goes in through the door a real sign-in comes through rather than round the side.
function aSignIn(externalId: string, first: string, last: string, withEmail = true): RequestInit {
  const body = JSON.stringify({
    type: 'user.created',
    data: {
      id: externalId,
      first_name: first,
      last_name: last,
      email_addresses: withEmail ? [{ id: 'e1', email_address: `${last.toLowerCase()}@example.com` }] : [],
      primary_email_address_id: 'e1',
    },
  })
  const messageId = 'msg_cold_start'
  const sentAt = new Date()

  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': messageId,
      'svix-timestamp': String(Math.floor(sentAt.getTime() / 1000)),
      'svix-signature': new Webhook(SIGNING_SECRET).sign(messageId, sentAt, body),
    },
    body,
  }
}

// Deliberately no fixture. A hand-written row once made an empty deployment look like a working one, so every test here starts from nothing at all.
function anEmptyDeployment() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../accounts/actions.ts': () => import('./actions'),
  })
}

describe('signing in', () => {
  it('writes an account and makes nobody', async () => {
    // The rule Nauman set: a sign-in is somebody who may use the ledger, and nothing more. Who they are in it -- partner, investor, client -- is written down where the money needs it.
    const t = anEmptyDeployment()

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect())
    expect(accounts.map((account) => account.primaryEmail)).toEqual(['partner@example.com'])
    // No person is invented from a sign-in. Guessing at one is how a partner's money would end up under a name nobody chose.
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toEqual([])
    // And nothing on the row says who they are in the books, because the row is what Clerk knows and no more.
    expect(
      Object.keys(accounts[0] ?? {})
        .filter((key) => !key.startsWith('_'))
        .sort()
    ).toEqual(['externalId', 'name', 'otherEmails', 'primaryEmail'])
  })

  it('gives the first person in full use of an empty ledger', async () => {
    const t = anEmptyDeployment()

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    const signedIn = t.withIdentity({ subject: 'user_first' })
    const siteId = await signedIn.mutation(api.sites.mutations.start, {
      name: '1-A, Phase 0',
      builtForAClient: false,
      stage: 'building',
    })

    expect(await signedIn.query(api.sites.queries.all, {})).toHaveLength(1)
    expect((await signedIn.query(api.sites.queries.one, { siteId }))?.name).toBe('1-A, Phase 0')
  })

  it('gives the second person exactly the same, with no waiting and nobody to ask', async () => {
    // This is what was broken: everybody after the first arrived unlinked and was told to ask, on a screen nobody had built. There is nothing to be let into now.
    const t = anEmptyDeployment()

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)
    const first = t.withIdentity({ subject: 'user_first' })
    await first.mutation(api.sites.mutations.start, { name: '1-A, Phase 0', builtForAClient: false, stage: 'building' })

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_second', 'Another', 'newcomer'))).status).toBe(200)
    const second = t.withIdentity({ subject: 'user_second' })

    expect(await second.query(api.sites.queries.all, {})).toHaveLength(1)
    await second.mutation(api.sites.mutations.start, { name: '2-B, Phase 0', builtForAClient: true, stage: 'planning' })
    expect(await second.query(api.sites.queries.all, {})).toHaveLength(2)

    // And the first sees what the second started, because it is one set of books.
    expect(await first.query(api.sites.queries.all, {})).toHaveLength(2)
  })

  it('changes the account it has already written rather than starting another', async () => {
    const t = anEmptyDeployment()

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)
    const before = await t.run((ctx) => ctx.db.query('accounts').first())

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'newname'))).status).toBe(200)

    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect())
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.name).toBe('The newname')
    // The same row, not a second one wearing the same sign-in: two rows for one person is two people to everything that reads this table.
    expect(accounts[0]?._id).toBe(before?._id)
  })
})
