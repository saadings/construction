// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api } from '../_generated/api'
import schema from '../schema'

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'

// Assembled rather than written out, so this file holds no string shaped like a real key.
const THE_KEY = `sk_test_${btoa('construction invite tests')}`

type AskedOfClerk = { url: string; method: string; authorization: string; body: unknown }

function stubClerk(answers: (asked: AskedOfClerk) => { ok: boolean; status?: number; json: unknown }) {
  const asked: Array<AskedOfClerk> = []

  vi.stubGlobal('fetch', (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const call: AskedOfClerk = {
      url,
      method: init.method ?? 'GET',
      authorization: init.headers?.Authorization ?? '',
      body: init.body === undefined ? undefined : (JSON.parse(init.body) as unknown),
    }
    asked.push(call)

    const answer = answers(call)
    return Promise.resolve({
      ok: answer.ok,
      status: answer.status ?? (answer.ok ? 200 : 422),
      json: () => Promise.resolve(answer.json),
    })
  })

  return asked
}

function convexWithInvites() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../invites/actions.ts': () => import('./actions'),
  })
}

async function anAccount(t: ReturnType<typeof convexWithInvites>) {
  await t.run(async (ctx) => {
    await ctx.db.insert('accounts', {
      externalId: SIGNED_IN_AS,
      name: 'The partner',
      primaryEmail: 'partner@example.com',
      otherEmails: [],
    })
  })

  return t.withIdentity({ subject: SIGNED_IN_AS })
}

const oneInvitation = {
  id: 'inv_1',
  email_address: 'mason@example.com',
  created_at: 1_760_000_000_000,
  status: 'pending',
}

beforeEach(() => {
  vi.stubEnv('CLERK_SECRET_KEY', THE_KEY)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('inviting somebody', () => {
  it('asks Clerk to email them, and nothing else has to happen afterwards', async () => {
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: oneInvitation }))

    const invited = await signedIn.action(api.invites.actions.invite, { email: '  Mason@Example.com ' })

    expect(asked).toHaveLength(1)
    expect(asked[0]?.method).toBe('POST')
    expect(asked[0]?.url).toBe('https://api.clerk.com/v1/invitations')
    // Lowercased and trimmed on the way, because the same address typed with a capital is the same address.
    expect(asked[0]?.body).toMatchObject({ email_address: 'mason@example.com', notify: true })
    expect(invited).toEqual({ id: 'inv_1', email: 'mason@example.com', askedOn: 1_760_000_000_000 })
  })

  it('sends the key to Clerk and hands none of it back', async () => {
    // The whole reason this is an action. A key in a bundle is a key anybody has, so what comes back is checked for it too.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: oneInvitation }))

    const invited = await signedIn.action(api.invites.actions.invite, { email: 'mason@example.com' })

    expect(asked[0]?.authorization).toBe(`Bearer ${THE_KEY}`)
    expect(JSON.stringify(invited)).not.toContain(THE_KEY)
    expect(JSON.stringify(invited)).not.toContain('sk_test')
  })

  it('refuses something that is not an address before Clerk is asked at all', async () => {
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: oneInvitation }))

    expect(await refusalFrom(signedIn.action(api.invites.actions.invite, { email: 'the mason' }))).toBe(
      'That does not look like an email address.'
    )
    expect(await refusalFrom(signedIn.action(api.invites.actions.invite, { email: '   ' }))).toBe(
      'Put in the email address to send it to.'
    )
    expect(asked).toEqual([])
  })

  it('says one sentence when Clerk refuses, rather than passing its words on', async () => {
    // Clerk's own words name fields and identifiers. They are for us, in the log, and never for him.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    stubClerk(() => ({
      ok: false,
      status: 422,
      json: { errors: [{ code: 'duplicate_record', message: 'Invalid identifier' }] },
    }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const refusal = await refusalFrom(signedIn.action(api.invites.actions.invite, { email: 'mason@example.com' }))

    expect(refusal).toBe('That did not go through. Try once more in a moment.')
    expect(refusal).not.toMatch(/identifier|duplicate|record|422/i)
  })

  it('says which of the two is wrong when the key is not there at all', async () => {
    // Not a mistake anybody using the app can make or fix, and it would otherwise read as being refused.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: oneInvitation }))
    vi.stubEnv('CLERK_SECRET_KEY', '')

    expect(await refusalFrom(signedIn.action(api.invites.actions.invite, { email: 'mason@example.com' }))).toBe(
      'Inviting is not switched on yet. Whoever set this up needs to finish it.'
    )
    expect(asked).toEqual([])
  })

  it('is not reachable by somebody who is not signed in, and asks Clerk nothing', async () => {
    const t = convexWithInvites()
    await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: oneInvitation }))

    expect(await refusalFrom(t.action(api.invites.actions.invite, { email: 'mason@example.com' }))).toBe(
      'You have been signed out. Sign in again to carry on.'
    )
    expect(asked).toEqual([])
  })
})

describe('who is waiting to be let in', () => {
  it('reads the ones asked and not yet signed up, newest first', async () => {
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({
      ok: true,
      json: [
        oneInvitation,
        { id: 'inv_2', email_address: 'steel@example.com', created_at: 1_770_000_000_000, status: 'pending' },
      ],
    }))

    const waiting = await signedIn.action(api.invites.actions.whoIsWaiting, {})

    expect(asked[0]?.url).toContain('status=pending')
    expect(waiting.map((one) => one.email)).toEqual(['steel@example.com', 'mason@example.com'])
  })

  it('hands back the address and when it was asked, and nothing else Clerk sent', async () => {
    // An invitation carries a token and a link, and either would let anyone who saw the screen sign in as them.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    stubClerk(() => ({
      ok: true,
      json: [{ ...oneInvitation, url: 'https://accounts.example.com/invite?token=abc123', token: 'abc123' }],
    }))

    const waiting = await signedIn.action(api.invites.actions.whoIsWaiting, {})

    expect(waiting[0]).toEqual({ id: 'inv_1', email: 'mason@example.com', askedOn: 1_760_000_000_000 })
    expect(JSON.stringify(waiting)).not.toContain('abc123')
  })

  it('reads Clerk answering with a wrapper around the list, as well as a bare one', async () => {
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    stubClerk(() => ({ ok: true, json: { data: [oneInvitation], total_count: 1 } }))

    expect((await signedIn.action(api.invites.actions.whoIsWaiting, {})).map((one) => one.email)).toEqual([
      'mason@example.com',
    ])
  })
})

describe('taking somebody off', () => {
  it('tells Clerk to take the invitation back', async () => {
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: { ...oneInvitation, status: 'revoked' } }))

    await signedIn.action(api.invites.actions.takeOff, { id: 'inv_1' })

    expect(asked[0]?.method).toBe('POST')
    expect(asked[0]?.url).toBe('https://api.clerk.com/v1/invitations/inv_1/revoke')
  })

  it('cannot be turned into a call at some other address', async () => {
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    const asked = stubClerk(() => ({ ok: true, json: oneInvitation }))

    await signedIn.action(api.invites.actions.takeOff, { id: '../users/user_someone_else' })

    expect(asked[0]?.url).toBe('https://api.clerk.com/v1/invitations/..%2Fusers%2Fuser_someone_else/revoke')
  })
})
