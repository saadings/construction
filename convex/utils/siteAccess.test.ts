// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { siteMutation } from './siteAccess'

// Four ways to be refused, each checked against a side effect that must not have happened: a wrapper that ran the handler and then hid the answer passes a test that only looks at the answer.

/** Handler bodies push here, so "refused" can be told from "ran, then threw". */
const reached: Array<string> = []

const probe = {
  rename: siteMutation({
    handler: async (ctx) => {
      reached.push('rename')
      await ctx.db.patch('sites', ctx.siteId, { name: 'Renamed by whoever got through' })
      return ctx.personId
    },
  }),
}

function convexWithProbe() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../utils/siteAccessProbe.ts': () => Promise.resolve(probe),
  })
}

const one = makeFunctionReference<'query', { siteId: Id<'sites'> }, { name: string } | null>('sites/queries:one')
const rename = makeFunctionReference<'mutation', { siteId: Id<'sites'> }, Id<'people'>>('utils/siteAccessProbe:rename')

const SIGNED_IN_AS = 'user_nauman'

async function aSite(ctx: MutationCtx, name: string): Promise<Id<'sites'>> {
  return await ctx.db.insert('sites', { name, builtForAClient: false, stage: 'building', hidden: false })
}

/** Everything a signed-in partner needs, so each test below can take exactly one piece away. */
async function aPartnerOnASite(ctx: MutationCtx) {
  const siteId = await aSite(ctx, '359-R, Phase 7')
  const personId = await ctx.db.insert('people', { name: 'Nauman Saeed', hidden: false })
  await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'Nauman Saeed',
    primaryEmail: 'nauman@example.com',
    otherEmails: [],
    personId,
  })

  return { siteId, personId }
}

describe('opening a site', () => {
  it('shows it to a partner on that site', async () => {
    const t = convexWithProbe()
    const { siteId } = await t.run(aPartnerOnASite)

    const site = await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId })

    expect(site?.name).toBe('359-R, Phase 7')
  })

  it('shows nothing to someone who is not signed in', async () => {
    const t = convexWithProbe()
    const { siteId } = await t.run(aPartnerOnASite)

    await expect(t.query(one, { siteId })).rejects.toThrow()
  })

  it('shows nothing when the sign-in belongs to no account here', async () => {
    const t = convexWithProbe()
    const { siteId } = await t.run(aPartnerOnASite)

    // The webhook has not landed yet, or landed for somebody else. There is a person and a role, just not for this sign-in.
    const site = await t.withIdentity({ subject: 'user_never_synced' }).query(one, { siteId })

    expect(site).toBeNull()
  })

  it('shows nothing when the account has not been attached to a person', async () => {
    // What a newly invited partner hits on their first sign-in, and the case most likely to be missed.
    const t = convexWithProbe()

    const siteId = await t.run(async (ctx) => {
      const siteId = await aSite(ctx, '359-R, Phase 7')
      await ctx.db.insert('accounts', {
        externalId: SIGNED_IN_AS,
        name: 'Nauman Saeed',
        primaryEmail: 'nauman@example.com',
        otherEmails: [],
      })
      return siteId
    })

    const site = await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId })

    expect(site).toBeNull()
  })

  it('shows nothing on a site the person holds no role on', async () => {
    const t = convexWithProbe()

    const otherSite = await t.run(async (ctx) => {
      await aPartnerOnASite(ctx)
      // Reach is per site, not per account. Being a partner somewhere must not open everywhere.
      return await aSite(ctx, '478-R, Phase 7')
    })

    const site = await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId: otherSite })

    expect(site).toBeNull()
  })

  it.each(['client', 'investor'] as const)('shows nothing to a person who is only the %s', async (capacity) => {
    // A client and an investor hold a role so the money reads correctly. Neither of them signs in, and neither may open the site.
    const t = convexWithProbe()

    const siteId = await t.run(async (ctx) => {
      const siteId = await aSite(ctx, '359-R, Phase 7')
      const personId = await ctx.db.insert('people', { name: 'Dr Khalid Mirza', hidden: false })
      await ctx.db.insert('siteRoles', { personId, siteId, capacity })
      await ctx.db.insert('accounts', {
        externalId: SIGNED_IN_AS,
        name: 'Dr Khalid Mirza',
        primaryEmail: 'khalid@example.com',
        otherEmails: [],
        personId,
      })
      return siteId
    })

    const site = await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId })

    expect(site).toBeNull()
  })
})

describe('changing something on a site', () => {
  it('lets a partner through, and says which person came through', async () => {
    const t = convexWithProbe()
    const { siteId, personId } = await t.run(aPartnerOnASite)

    expect(await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(rename, { siteId })).toBe(personId)
    expect(reached).toContain('rename')
  })

  it('refuses anyone else out loud, and writes nothing', async () => {
    const reachedBefore = reached.length
    const t = convexWithProbe()

    const otherSite = await t.run(async (ctx) => {
      await aPartnerOnASite(ctx)
      return await aSite(ctx, '478-R, Phase 7')
    })

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    await expect(signedIn.mutation(rename, { siteId: otherSite })).rejects.toThrow('This site is not one of yours.')

    // Silence would read as saved, so the mutation throws where the query returns nothing.
    expect(reached.length).toBe(reachedBefore)
    expect(await t.run((ctx) => ctx.db.get('sites', otherSite))).toMatchObject({ name: '478-R, Phase 7' })
  })

  it('refuses in words Nauman would use', async () => {
    const t = convexWithProbe()
    const siteId = await t.run((ctx) => aSite(ctx, '359-R, Phase 7'))

    // What the phone actually receives. A plain `Error` reaches production as "Server Error", so the words are only real if they travel in `data`.
    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(rename, { siteId })
      .catch((thrown: unknown) =>
        thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
      )

    for (const technical of /record|entry|entity|ledger|sync|category|vendor|field|validation|required|error|database|query|permission|unauthori[sz]ed|forbidden|access/i.source.split(
      '|'
    )) {
      expect(refusal).not.toMatch(new RegExp(technical, 'i'))
    }
    // The control: the assertion above passes trivially against a message that says nothing at all.
    expect(refusal).toContain('not one of yours')
  })
})
