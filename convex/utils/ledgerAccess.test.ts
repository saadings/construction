// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_thepartner'

function convexWithEverything() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../utils/ledgerAccess.ts': () => import('./ledgerAccess'),
    '../utils/siteAccess.ts': () => import('./siteAccess'),
    '../utils/auth.ts': () => import('./auth'),
  })
}

/** A sign-in and nothing else. No person, no role, nothing anywhere: what everybody invited to this app looks like the moment they arrive. */
async function justSignedIn(ctx: MutationCtx) {
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })
}

const aHouse = { name: '000-B, Phase 1', builtForAClient: false, stage: 'building' } as const

describe('somebody who has just signed in for the first time', () => {
  it('has the whole ledger, holding no role on anything', async () => {
    // The rule Nauman set: this is a simple ledger for one partnership, and everyone let in by the sign-in list uses it. Nothing waits on being joined to a person.
    const t = convexWithEverything()
    await t.run(justSignedIn)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    expect(await t.run((ctx) => ctx.db.query('people').collect())).toEqual([])

    for (const reading of [api.people.queries.list, api.trades.queries.list, api.bankAccounts.queries.list] as const) {
      expect(await signedIn.query(reading, {})).not.toBeNull()
    }
  })

  it('starts a house, and everybody signed in sees it', async () => {
    const t = convexWithEverything()
    await t.run(justSignedIn)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const siteId = await signedIn.mutation(api.sites.mutations.start, aHouse)

    expect(await signedIn.query(api.sites.queries.all, {})).toHaveLength(1)
    // Who is a partner, an investor or a client on it is written down where the money needs it, and starting a house says nothing about that.
    expect(await t.run((ctx) => ctx.db.query('siteRoles').collect())).toEqual([])

    // Another sign-in, arriving after the house was started, with nothing of their own.
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_another',
        name: 'Another partner',
        primaryEmail: 'another@example.com',
        otherEmails: [],
      })
    })

    const alsoSignedIn = t.withIdentity({ subject: 'user_another' })
    expect(await alsoSignedIn.query(api.sites.queries.all, {})).toHaveLength(1)
    expect((await alsoSignedIn.query(api.sites.queries.one, { siteId }))?.name).toBe(aHouse.name)
  })

  it('adds a person, a trade and a bank account', async () => {
    const t = convexWithEverything()
    await t.run(justSignedIn)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.people.mutations.add, { name: 'The Steel Supplier' })
    await signedIn.mutation(api.bankAccounts.mutations.add, { label: 'Second account', lastFourDigits: '4242' })

    expect(await t.run((ctx) => ctx.db.query('people').collect())).toHaveLength(1)
    expect(await t.run((ctx) => ctx.db.query('bankAccounts').collect())).toHaveLength(1)
  })
})

describe('a sign-in the ledger has not heard of', () => {
  // The gap between signing in and the webhook landing, which is a moment rather than a state anybody stays in. It is not somebody being kept out.
  it('is shown nothing until its account arrives', async () => {
    const t = convexWithEverything()
    const stranger = t.withIdentity({ subject: 'user_the_webhook_has_not_landed_for' })

    expect(await stranger.query(api.people.queries.list, {})).toBeNull()

    // The control: the same sign-in, once its account is there, is let straight in.
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_the_webhook_has_not_landed_for',
        name: 'Just arrived',
        primaryEmail: 'arrived@example.com',
        otherEmails: [],
      })
    })

    expect(await stranger.query(api.people.queries.list, {})).not.toBeNull()
  })

  it('is refused out loud when it tries to write, and writes nothing', async () => {
    const t = convexWithEverything()
    const stranger = t.withIdentity({ subject: 'user_the_webhook_has_not_landed_for' })

    expect(await refusalFrom(stranger.mutation(api.people.mutations.add, { name: 'The Steel Supplier' }))).toBe(
      'Your sign-in has not come through yet. Try again in a moment.'
    )
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toEqual([])
  })
})

describe('somebody not signed in at all', () => {
  it('is refused everywhere, which is the one rule that did not change', async () => {
    const t = convexWithEverything()
    await t.run(justSignedIn)

    // The sentence itself belongs to the sign-out refusal and is asserted where that lives; what matters here is that nothing gets through and nothing is written.
    await expect(t.query(api.people.queries.list, {})).rejects.toThrow()
    await expect(t.mutation(api.sites.mutations.start, aHouse)).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('sites').collect())).toEqual([])
  })
})
