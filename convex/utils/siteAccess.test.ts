// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { siteMutation } from './siteAccess'

// One partnership, one set of books: whoever the sign-in list lets in sees every house. What is left to check is that being signed in is really required, and that a house nobody has is still nothing.

// Each refusal is checked against a side effect that must not have happened: a wrapper that ran the handler and then hid the answer passes a test that only looks at the answer.

/** Handler bodies push here, so "refused" can be told from "ran, then threw". */
const reached: Array<string> = []

const probe = {
  rename: siteMutation({
    handler: async (ctx) => {
      reached.push('rename')
      await ctx.db.patch('sites', ctx.siteId, { name: 'Renamed by whoever got through' })
      return ctx.siteId
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
const rename = makeFunctionReference<'mutation', { siteId: Id<'sites'> }, Id<'sites'>>('utils/siteAccessProbe:rename')

const SIGNED_IN_AS = 'user_thepartner'

async function aSite(ctx: MutationCtx, name: string): Promise<Id<'sites'>> {
  return await ctx.db.insert('sites', { name, builtForAClient: false, stage: 'building', hidden: false })
}

/** A sign-in and nothing else: no person, no role on anything. This is what everybody signing in for the first time now looks like. */
async function signedInAndNothingMore(ctx: MutationCtx) {
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })
}

describe('opening a site', () => {
  it('shows it to anybody signed in, holding no role on it at all', async () => {
    // The rule that replaced the old one. There is no such thing as somebody else's house here: four people keep one set of books between them.
    const t = convexWithProbe()
    const siteId = await t.run(async (ctx) => {
      await signedInAndNothingMore(ctx)
      return await aSite(ctx, '1-A, Phase 0')
    })

    const site = await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId })

    expect(site?.name).toBe('1-A, Phase 0')
  })

  it('shows it on a house somebody else started, with somebody else on it', async () => {
    const t = convexWithProbe()
    const theirs = await t.run(async (ctx) => {
      await signedInAndNothingMore(ctx)

      const siteId = await aSite(ctx, '2-B, Phase 0')
      const somebodyElse = await ctx.db.insert('people', { name: 'Another partner', hidden: false })
      await ctx.db.insert('siteRoles', { personId: somebodyElse, siteId, capacity: 'partner' })

      return siteId
    })

    expect((await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId: theirs }))?.name).toBe('2-B, Phase 0')
  })

  it('shows nothing to someone who is not signed in', async () => {
    const t = convexWithProbe()
    const siteId = await t.run((ctx) => aSite(ctx, '1-A, Phase 0'))

    await expect(t.query(one, { siteId })).rejects.toThrow()
  })

  it('shows nothing for a house that is not there', async () => {
    const t = convexWithProbe()
    const gone = await t.run(async (ctx) => {
      await signedInAndNothingMore(ctx)

      const siteId = await aSite(ctx, '3-C, Phase 0')
      await ctx.db.delete('sites', siteId)
      return siteId
    })

    expect(await t.withIdentity({ subject: SIGNED_IN_AS }).query(one, { siteId: gone })).toBeNull()
  })
})

describe('changing something on a site', () => {
  it('lets anybody signed in through, and hands the handler the house', async () => {
    const t = convexWithProbe()
    const siteId = await t.run(async (ctx) => {
      await signedInAndNothingMore(ctx)
      return await aSite(ctx, '1-A, Phase 0')
    })

    expect(await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(rename, { siteId })).toBe(siteId)
    expect(reached).toContain('rename')
  })

  it('refuses a house that is not there, out loud, and writes nothing', async () => {
    const reachedBefore = reached.length
    const t = convexWithProbe()

    const gone = await t.run(async (ctx) => {
      await signedInAndNothingMore(ctx)

      const siteId = await aSite(ctx, '3-C, Phase 0')
      await ctx.db.delete('sites', siteId)
      return siteId
    })

    // Silence would read as saved, so the mutation throws where the query returns nothing.
    const refusal = await refusalFrom(t.withIdentity({ subject: SIGNED_IN_AS }).mutation(rename, { siteId: gone }))

    expect(refusal).toBe('That house is not in the ledger.')
    expect(reached.length).toBe(reachedBefore)
  })

  it('refuses somebody not signed in at all, before the handler runs', async () => {
    const reachedBefore = reached.length
    const t = convexWithProbe()
    const siteId = await t.run((ctx) => aSite(ctx, '1-A, Phase 0'))

    // The words of the sign-out refusal belong where that refusal lives; here it is that nothing ran and nothing changed.
    await expect(t.mutation(rename, { siteId })).rejects.toThrow()

    expect(reached.length).toBe(reachedBefore)
    expect(await t.run((ctx) => ctx.db.get('sites', siteId))).toMatchObject({ name: '1-A, Phase 0' })
  })

  it('refuses in words Nauman would use', async () => {
    const t = convexWithProbe()
    const gone = await t.run(async (ctx) => {
      await signedInAndNothingMore(ctx)

      const siteId = await aSite(ctx, '3-C, Phase 0')
      await ctx.db.delete('sites', siteId)
      return siteId
    })

    // What the phone actually receives. A plain `Error` reaches production as "Server Error", so the words are only real if they travel in `data`.
    const refusal = await refusalFrom(t.withIdentity({ subject: SIGNED_IN_AS }).mutation(rename, { siteId: gone }))

    for (const technical of /record|entry|entity|sync|category|vendor|field|validation|required|error|database|query|permission|unauthori[sz]ed|forbidden|access/i.source.split(
      '|'
    )) {
      expect(refusal).not.toMatch(new RegExp(technical, 'i'))
    }
    // The control: the assertion above passes trivially against a message that says nothing at all.
    expect(refusal).toBe('That house is not in the ledger.')
  })
})
