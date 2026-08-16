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

    // `text` as well as `json`, because a refusal's body is now read rather than discarded -- and a real `Response` can only be read once, so the two are the same body reached two ways rather than two bodies.
    return Promise.resolve({
      ok: answer.ok,
      status: answer.status ?? (answer.ok ? 200 : 422),
      json: () => Promise.resolve(answer.json),
      text: () => Promise.resolve(JSON.stringify(answer.json)),
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

  it('says what Clerk actually refused, in our words rather than theirs', async () => {
    // This asserted the generic sentence until Nauman met it: he invited his first partner, Clerk said the address was already spoken for, and the app told him to try once more in a moment -- the one answer that could never work. The status and the code went to a log nobody watching a screen can read.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    stubClerk(() => ({
      ok: false,
      status: 422,
      json: { errors: [{ code: 'duplicate_record', message: 'Invalid identifier' }] },
    }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const refusal = await refusalFrom(signedIn.action(api.invites.actions.invite, { email: 'mason@example.com' }))

    expect(refusal).toBe('That address has already been invited, or somebody is signed in with it already.')

    // Clerk's own words still never reach a screen. They name fields and identifiers and quote the address back.
    expect(refusal).not.toMatch(/identifier|duplicate|record|422/i)
  })

  it('still says the one generic sentence for a refusal nothing has been taught to name', async () => {
    // The other end. Naming some cases must not turn every unnamed one into a guess, and a mapping that answered confidently for everything would be worse than the sentence it replaced.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    stubClerk(() => ({ ok: false, status: 500, json: { errors: [{ code: 'nobody_has_seen_this' }] } }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const refusal = await refusalFrom(signedIn.action(api.invites.actions.invite, { email: 'mason@example.com' }))

    expect(refusal).toBe('That did not go through. Try once more in a moment.')
  })

  it('reaches the other two ways of asking Clerk, which share the same blindness', async () => {
    // `whoIsWaiting` and `takeOff` go through the same helper, so the mapping is a property of asking Clerk rather than of inviting.
    const t = convexWithInvites()
    const signedIn = await anAccount(t)
    stubClerk(() => ({ ok: false, status: 429, json: { errors: [{ code: 'rate_limit_exceeded' }] } }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await refusalFrom(signedIn.action(api.invites.actions.whoIsWaiting, {}))).toBe(
      'Too many invitations just now. Try again in a few minutes.'
    )
    expect(await refusalFrom(signedIn.action(api.invites.actions.takeOff, { id: 'inv_1' }))).toBe(
      'Too many invitations just now. Try again in a few minutes.'
    )
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
