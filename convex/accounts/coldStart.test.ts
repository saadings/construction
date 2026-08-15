// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { Webhook } from 'svix'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { personName } from '../../shared/validation/primitives'
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

// Deliberately no fixture. The whole defect was that a hand-written row made an empty deployment look like a working one, so every test here starts from nothing at all.
function anEmptyDeployment() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../accounts/actions.ts': () => import('./actions'),
  })
}

describe('the first person ever to sign in', () => {
  it('becomes a person, because there is nobody to ask', async () => {
    // Without this the first sign-in on a fresh deployment sees an empty list and is told to ask Nauman, when he is Nauman. There was no path from signed-in to has-a-person except editing the database by hand.
    const t = anEmptyDeployment()

    expect(await t.run((ctx) => ctx.db.query('people').collect())).toEqual([])

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    const people = await t.run((ctx) => ctx.db.query('people').collect())
    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect())

    expect(people.map((person) => person.name)).toEqual(['The partner'])
    expect(accounts[0]?.personId).toBe(people[0]?._id)
  })

  it.each([
    ['a one-letter first name and no surname', 'A', '', false],
    ['no name and no email, which a phone-only sign-up gives', '', '', false],
  ] as Array<[string, string, string, boolean?]>)(
    'is called something the ledger would accept, given %s',
    async (_case, first, last, withEmail = true) => {
      // This row is the first partner's own, and every site role, payment and balance hangs off it. It is written once per deployment and never looked at by hand again.
      const t = anEmptyDeployment()

      expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', first, last, withEmail))).status).toBe(200)

      const [person] = await t.run((ctx) => ctx.db.query('people').collect())
      expect(person?.name).toBe('Whoever set this up')
      // What every other write to this table would have insisted on.
      expect(personName.safeParse(person?.name).success).toBe(true)
    }
  )

  it('keeps a name the ledger would accept, rather than replacing every one', async () => {
    // The control: without this, returning the placeholder unconditionally passes the two above.
    const t = anEmptyDeployment()

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    const [person] = await t.run((ctx) => ctx.db.query('people').collect())
    expect(person?.name).toBe('The partner')
  })

  it('can start a site straight away, which is the whole point', async () => {
    const t = anEmptyDeployment()
    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    const signedIn = t.withIdentity({ subject: 'user_first' })
    const siteId = await signedIn.mutation(api.sites.mutations.start, {
      name: '1-A, Phase 0',
      builtForAClient: false,
      stage: 'building',
    })

    expect(await signedIn.query(api.sites.queries.mine, {})).toHaveLength(1)
    expect(await signedIn.query(api.sites.queries.one, { siteId })).toMatchObject({ name: '1-A, Phase 0' })
  })
})

describe('everyone who signs in after', () => {
  it('arrives attached to nobody, and waits', async () => {
    // Making a person for every sign-in would give a supplier who later signs in two rows -- his vendor history on one and his partner identity on the other -- in a ledger whose whole purpose is that one person has one balance.
    const t = anEmptyDeployment()

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)
    expect((await t.fetch('/webhooks/clerk', aSignIn('user_second', 'A', 'newcomer'))).status).toBe(200)

    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect())
    const second = accounts.find((account) => account.externalId === 'user_second')

    expect(second?.personId).toBeUndefined()
    // Still only the first person. The second sign-in made nobody.
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toHaveLength(1)
  })

  it('is told to ask, and that is now correct rather than a dead end', async () => {
    const t = anEmptyDeployment()
    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)
    expect((await t.fetch('/webhooks/clerk', aSignIn('user_second', 'A', 'newcomer'))).status).toBe(200)

    const aHouse = { name: '1-A, Phase 0', builtForAClient: false, stage: 'building' } as const

    const refusal = await t
      .withIdentity({ subject: 'user_second' })
      .mutation(api.sites.mutations.start, aHouse)
      .then(
        () => 'nothing was refused',
        (thrown: unknown) => String(thrown)
      )
    expect(refusal).toContain('Ask Nauman to add you')

    // The control: the first account starts one on the same call, so this is the link deciding rather than starting a site being broken for everybody.
    await t.withIdentity({ subject: 'user_first' }).mutation(api.sites.mutations.start, aHouse)
    expect(await t.run((ctx) => ctx.db.query('sites').collect())).toHaveLength(1)
  })
})

describe('a deployment left half set up', () => {
  it('still links the next sign-in, rather than needing the database edited by hand', async () => {
    // The condition is "has anybody been linked", not "is this the first webhook", so an account that arrived before this existed does not strand the deployment forever.
    const t = anEmptyDeployment()

    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_stranded',
        name: 'Stranded',
        primaryEmail: 'stranded@example.com',
        otherEmails: [],
      })
    })

    expect((await t.fetch('/webhooks/clerk', aSignIn('user_next', 'The', 'partner'))).status).toBe(200)

    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect())
    expect(accounts.find((account) => account.externalId === 'user_next')?.personId).toBeDefined()
  })

  it('does not link a second person once anybody is linked', async () => {
    const t = anEmptyDeployment()
    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    // Signing in again must not make another person, or a partner acquires a second identity every time Clerk resends.
    expect((await t.fetch('/webhooks/clerk', aSignIn('user_first', 'The', 'partner'))).status).toBe(200)

    expect(await t.run((ctx) => ctx.db.query('people').collect())).toHaveLength(1)
    expect(await t.run((ctx) => ctx.db.query('accounts').collect())).toHaveLength(1)
  })
})
