// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import { mutation } from '../_generated/server'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_nauman'

// Does what `start` does, in the same order, and then fails. A site written without its role would be one nobody can open and nobody can see.
const probe = {
  startThenFail: mutation({
    args: {},
    handler: async (ctx) => {
      const personId = await ctx.db.insert('people', { name: 'The partner', hidden: false })
      const siteId = await ctx.db.insert('sites', {
        name: '1-A, Phase 0',
        builtForAClient: false,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })

      throw new Error('after both writes')
    },
  }),
}

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithSites() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../sites/mutations.ts': () => import('./mutations'),
    '../sites/queries.ts': () => import('./queries'),
    '../sites/startProbe.ts': () => Promise.resolve(probe),
  })
}

const aHouse = {
  name: '  1-A,   Phase 0 ',
  plotNumber: '1-A',
  phase: 'Phase 0',
  coveredAreaSqft: '5,500',
  builtForAClient: false,
  stage: 'building',
} as const

async function anAccountFor(ctx: MutationCtx, { withAPerson }: { withAPerson: boolean }) {
  const personId = withAPerson ? await ctx.db.insert('people', { name: 'The partner', hidden: false }) : undefined

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'nauman@example.com',
    otherEmails: [],
    personId,
  })

  return personId
}

async function refusalFrom(promise: Promise<unknown>) {
  return await promise.then(
    () => 'nothing was refused',
    (thrown: unknown) =>
      thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
  )
}

describe('starting a site', () => {
  it('makes whoever started it a partner on it', async () => {
    // Otherwise the first site anyone makes is one nobody can open, and the link would have to be set by hand on a live deployment.
    const t = convexWithSites()
    const personId = await t.run((ctx) => anAccountFor(ctx, { withAPerson: true }))

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const siteId = await signedIn.mutation(api.sites.mutations.start, aHouse)

    expect(await signedIn.query(api.sites.queries.one, { siteId })).toMatchObject({ name: '1-A, Phase 0' })
    expect(await signedIn.query(api.sites.queries.mine, {})).toHaveLength(1)

    const held = await t.run((ctx) => ctx.db.query('siteRoles').collect())
    expect(held).toMatchObject([{ personId, siteId, capacity: 'partner' }])
  })

  it('writes the site and the role together or not at all', async () => {
    // If the site landed and the role did not, the result is a house nobody can open and nobody can see, with no screen that could repair it.
    const t = convexWithSites()
    const startThenFail = makeFunctionReference<'mutation', Record<string, never>, null>(
      'sites/startProbe:startThenFail'
    )

    await expect(t.mutation(startThenFail, {})).rejects.toThrow('after both writes')

    expect(await t.run((ctx) => ctx.db.query('sites').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('siteRoles').collect())).toEqual([])
    // The control: the person written before the site is gone too, so this is one transaction rolling back and not a site that was never written.
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toEqual([])
  })

  it('tidies what was typed before storing it', async () => {
    const t = convexWithSites()
    await t.run((ctx) => anAccountFor(ctx, { withAPerson: true }))

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const siteId = await signedIn.mutation(api.sites.mutations.start, aHouse)

    const site = await t.run((ctx) => ctx.db.get('sites', siteId))
    // Two spaces and a trailing one went in; the name is stored the way it is said.
    expect(site?.name).toBe('1-A, Phase 0')
    // A comma-grouped figure went in, a number came out, because the form and the server run the same schema.
    expect(site?.coveredAreaSqft).toBe(5500)
  })

  it('turns away someone whose sign-in is not attached to a person, and writes nothing', async () => {
    const t = convexWithSites()
    await t.run((ctx) => anAccountFor(ctx, { withAPerson: false }))

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.sites.mutations.start, aHouse)
    )

    expect(refusal).toContain('Ask Nauman to add you')
    expect(await t.run((ctx) => ctx.db.query('sites').collect())).toEqual([])
  })

  it('says what is wrong in words, and writes nothing', async () => {
    const t = convexWithSites()
    await t.run((ctx) => anAccountFor(ctx, { withAPerson: true }))

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.sites.mutations.start, { ...aHouse, name: 'R' })
    )

    expect(refusal).toContain('Give this site a name')
    for (const technical of ['record', 'entry', 'entity', 'ledger', 'category', 'field', 'validation', 'required']) {
      expect(refusal).not.toMatch(new RegExp(technical, 'i'))
    }
    expect(await t.run((ctx) => ctx.db.query('sites').collect())).toEqual([])
  })

  it('refuses a covered area nobody typed on purpose', async () => {
    const t = convexWithSites()
    await t.run((ctx) => anAccountFor(ctx, { withAPerson: true }))

    const refusal = await refusalFrom(
      t
        .withIdentity({ subject: SIGNED_IN_AS })
        .mutation(api.sites.mutations.start, { ...aHouse, coveredAreaSqft: '550000' })
    )

    expect(refusal).toContain('covered area in square feet')
  })
})

describe('the sites on the home screen', () => {
  it('leaves out a site the person is only the client or the investor on', async () => {
    // The same rule the site itself is guarded by. A list that disagreed with the guard would show doors that will not open.
    const t = convexWithSites()

    await t.run(async (ctx) => {
      const personId = await anAccountFor(ctx, { withAPerson: true })
      if (!personId) throw new Error('no person')

      for (const [name, capacity] of [
        ['1-A, Phase 0', 'partner'],
        ['478-R, Phase 0', 'investor'],
        ['12-C, Phase 5', 'client'],
      ] as const) {
        const siteId = await ctx.db.insert('sites', {
          name,
          builtForAClient: false,
          stage: 'building',
          hidden: false,
        })
        await ctx.db.insert('siteRoles', { personId, siteId, capacity })
      }
    })

    const mine = await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.sites.queries.mine, {})

    expect(mine.map((site) => site.name)).toEqual(['1-A, Phase 0'])
  })

  it('leaves out a site that has been hidden', async () => {
    const t = convexWithSites()
    await t.run((ctx) => anAccountFor(ctx, { withAPerson: true }))

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const siteId = await signedIn.mutation(api.sites.mutations.start, aHouse)
    await signedIn.mutation(api.sites.mutations.hide, { siteId })

    expect(await signedIn.query(api.sites.queries.mine, {})).toEqual([])
    // Hidden, not gone: the payments on it still point at a site that is there.
    expect(await t.run((ctx) => ctx.db.get('sites', siteId))).toMatchObject({ hidden: true })
  })
})
