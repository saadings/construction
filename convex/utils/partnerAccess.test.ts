// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_thepartner'

function convexWithEverything() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../utils/partnerAccess.ts': () => import('./partnerAccess'),
    '../utils/siteAccess.ts': () => import('./siteAccess'),
    '../utils/auth.ts': () => import('./auth'),
  })
}

/** A real sign-in attached to a real person, and nothing else. No site, no role: the state the first person to ever sign in is in. */
async function signedInWithNoSite(ctx: MutationCtx): Promise<Id<'people'>> {
  const personId = await ctx.db.insert('people', { name: 'The Partner', hidden: false })

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The Partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
    personId,
  })

  return personId
}

async function alsoAPartner(ctx: MutationCtx, personId: Id<'people'>) {
  const siteId = await ctx.db.insert('sites', {
    name: '000-A, Phase 1',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })

  return siteId
}

const aHouse = { name: '000-B, Phase 1', builtForAClient: false, stage: 'building' } as const

describe('the first person ever to sign in', () => {
  it('can start a site while holding no role at all, and is its partner afterwards', async () => {
    // The one path nobody will re-test by hand, and the one the wrapper is most likely to break: starting a site is what makes someone a partner, so it cannot require being one.
    const t = convexWithEverything()
    const personId = await t.run(signedInWithNoSite)

    expect(await t.run((ctx) => ctx.db.query('siteRoles').collect())).toEqual([])

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const siteId = await signedIn.mutation(api.sites.mutations.start, aHouse)

    expect(await t.run((ctx) => ctx.db.query('siteRoles').collect())).toMatchObject([
      { personId, siteId, capacity: 'partner' },
    ])
    expect(await signedIn.query(api.sites.queries.mine, {})).toHaveLength(1)
  })

  it('is shown nobody until they are on a site, and everybody once they are', async () => {
    // The refusal and the success in one test. Without the second half this passes just as well against a codebase where the wrapper refuses everyone, or where it was deleted and nothing is applied.
    const t = convexWithEverything()
    const personId = await t.run(signedInWithNoSite)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    expect(await signedIn.query(api.people.queries.list, {})).toBeNull()

    await t.run((ctx) => alsoAPartner(ctx, personId))

    expect(await signedIn.query(api.people.queries.list, {})).toHaveLength(1)
  })
})

describe('what a signed-in stranger can reach', () => {
  it.each([
    ['people', api.people.queries.list],
    ['trades', api.trades.queries.list],
    ['bank accounts', api.bankAccounts.queries.list],
  ] as const)('is not the list of %s, until they are a partner', async (_what, reading) => {
    const t = convexWithEverything()
    const personId = await t.run(signedInWithNoSite)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    expect(await signedIn.query(reading, {})).toBeNull()

    // The control. A list that came back null because the wrapper refuses everyone, or because the table is simply empty, would pass the line above on its own.
    await t.run((ctx) => alsoAPartner(ctx, personId))
    expect(await signedIn.query(reading, {})).not.toBeNull()
  })

  it('is not a person to add, edit or hide', async () => {
    const t = convexWithEverything()
    const personId = await t.run(signedInWithNoSite)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const refusal = await signedIn.mutation(api.people.mutations.add, { name: 'The Steel Supplier' }).then(
      () => 'nothing was refused',
      (thrown: unknown) =>
        thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
    )

    expect(refusal).toContain('Ask Nauman to put you on a site first.')
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toHaveLength(1)

    // The success that makes the refusal mean something.
    await t.run((ctx) => alsoAPartner(ctx, personId))
    await signedIn.mutation(api.people.mutations.add, { name: 'The Steel Supplier' })
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toHaveLength(2)
  })

  it('is not a bank account to add', async () => {
    const t = convexWithEverything()
    const personId = await t.run(signedInWithNoSite)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await expect(
      signedIn.mutation(api.bankAccounts.mutations.add, { label: 'Test Bank 0000', lastFourDigits: '0000' })
    ).rejects.toThrow('Ask Nauman')
    expect(await t.run((ctx) => ctx.db.query('bankAccounts').collect())).toEqual([])

    await t.run((ctx) => alsoAPartner(ctx, personId))
    await signedIn.mutation(api.bankAccounts.mutations.add, { label: 'Test Bank 0000', lastFourDigits: '0000' })
    expect(await t.run((ctx) => ctx.db.query('bankAccounts').collect())).toHaveLength(1)
  })

  it('is nothing at all when the sign-in was never attached to a person', async () => {
    // Holding a partner role is not enough on its own: the account has to be joined to the person holding it.
    const t = convexWithEverything()

    await t.run(async (ctx) => {
      const personId = await ctx.db.insert('people', { name: 'The Partner', hidden: false })
      await alsoAPartner(ctx, personId)
      await ctx.db.insert('accounts', {
        externalId: SIGNED_IN_AS,
        name: 'The Partner',
        primaryEmail: 'partner@example.com',
        otherEmails: [],
      })
    })

    expect(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.list, {})).toBeNull()
  })

  it('is refused entirely when signed out', async () => {
    const t = convexWithEverything()
    await t.run(signedInWithNoSite)

    await expect(t.query(api.people.queries.list, {})).rejects.toThrow()
  })
})

describe('a client or an investor', () => {
  it.each(['client', 'investor'] as const)('holds a role and still reaches nothing, as the %s', async (capacity) => {
    // They hold a role so the money reads correctly. Neither of them signs in to anything.
    const t = convexWithEverything()

    const personId = await t.run(async (ctx) => {
      const personId = await signedInWithNoSite(ctx)
      const siteId = await ctx.db.insert('sites', {
        name: '000-A, Phase 1',
        builtForAClient: true,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.insert('siteRoles', { personId, siteId, capacity })
      return personId
    })

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    expect(await signedIn.query(api.people.queries.list, {})).toBeNull()

    // The control: the same person, made a partner somewhere, is let through.
    await t.run((ctx) => alsoAPartner(ctx, personId))
    expect(await signedIn.query(api.people.queries.list, {})).not.toBeNull()
  })
})
