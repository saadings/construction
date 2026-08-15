// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_partner'

// A refusal crosses the wire as JSON, so `data` arrives with its quotes still on. Compared whole rather than by `toContain`, which passes just as happily on a sentence that was wrapped, cut short or stuck to something else.
function theWordsIn(thrown: unknown): string {
  if (!(thrown instanceof ConvexError)) {
    return 'thrown as something a phone never sees'
  }

  const carried = String(thrown.data)
  try {
    const decoded: unknown = JSON.parse(carried)
    return typeof decoded === 'string' ? decoded : carried
  } catch {
    return carried
  }
}

function convexWithContracts() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../contracts/mutations.ts': () => import('./mutations'),
    '../contracts/queries.ts': () => import('./queries'),
  })
}

type AHouse = { siteId: Id<'sites'>; clientId: Id<'people'> }

async function aHouseBuiltForAClient(ctx: MutationCtx): Promise<AHouse> {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const clientId = await ctx.db.insert('people', { name: 'A client', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })

  await ctx.db.insert('siteRoles', { personId: partner, siteId, capacity: 'partner' })
  await ctx.db.insert('siteRoles', { personId: clientId, siteId, capacity: 'client' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
    personId: partner,
  })

  return { siteId, clientId }
}

const aRateContract = (clientId: Id<'people'>) => ({
  clientId,
  agreedOn: '2026-03-14',
  priced: { how: 'ratePerSqft', ratePerSqftPaisa: '2,400' } as const,
  agreedAreaSqft: '5,000',
})

describe('what a client agreed to pay', () => {
  it('is worked out on every read and written down nowhere', async () => {
    // The whole point. A stored total is the figure that stays behind when the house is measured again, which is what the workbooks did.
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    const stored = await t.run((ctx) => ctx.db.query('contracts').collect())
    // No total, no value, no anything that could be added up: a rate contract stores the rate and the area and nothing worked out from them.
    expect(
      Object.keys(stored[0] ?? {})
        .filter((key) => !key.startsWith('_'))
        .sort()
    ).toEqual(['agreedAreaSqft', 'agreedOn', 'clientId', 'hidden', 'priced', 'siteId'])

    const read = await signedIn.query(api.contracts.queries.forSite, { siteId })
    expect(read?.valuePaisa).toBe(2_400_00 * 5_000)
  })

  it('moves when the house is measured, without the agreed area moving', async () => {
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
    await signedIn.mutation(api.contracts.mutations.measure, { siteId, contractId, actualAreaSqft: '5,250' })

    const read = await signedIn.query(api.contracts.queries.forSite, { siteId })

    expect(read?.valuePaisa).toBe(2_400_00 * 5_250)
    // What was agreed is what a disagreement is settled against, so it stays exactly as it was.
    expect(read?.agreedAreaSqft).toBe(5_000)
    expect(read?.actualAreaSqft).toBe(5_250)
  })

  it('refuses a second contract on the same house', async () => {
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    const refusal = await signedIn
      .mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
      .then(() => 'nothing was refused', theWordsIn)

    expect(refusal).toBe('This house already has a contract. Change that one rather than agreeing a second.')
    expect(await t.run((ctx) => ctx.db.query('contracts').collect())).toHaveLength(1)
  })

  it('is reachable by anybody signed in, holding no role on the house', async () => {
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)

    const other = await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_stranger',
        name: 'Another partner',
        primaryEmail: 'another@example.com',
        otherEmails: [],
      })
      return 'user_stranger'
    })

    // One partnership, one set of books: a sign-in with no person and no role agrees a contract on any house in it.
    await t
      .withIdentity({ subject: other })
      .mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    expect(await t.run((ctx) => ctx.db.query('contracts').collect())).toHaveLength(1)
    // And it is still the door: somebody not signed in at all writes nothing.
    await expect(t.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('contracts').collect())).toHaveLength(1)
  })

  it('can be corrected, because a rate typed wrong is otherwise permanent', async () => {
    // `agree` refuses a second while the first stands, so without this a typo in the rate could never be reached again.
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
    await signedIn.mutation(api.contracts.mutations.revise, {
      siteId,
      contractId,
      priced: { how: 'ratePerSqft', ratePerSqftPaisa: '2,600' },
      agreedAreaSqft: '5,000',
    })

    const read = await signedIn.query(api.contracts.queries.forSite, { siteId })
    expect(read?.valuePaisa).toBe(2_600_00 * 5_000)
    // The client and the day agreed are left alone: changing those is a different contract, not a correction.
    expect(read?.clientId).toBe(clientId)
    expect(read?.agreedOn).toBe('2026-03-14')
  })

  it('can be cancelled and the house agreed again, without erasing what was agreed', async () => {
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
    await signedIn.mutation(api.contracts.mutations.cancel, { siteId, contractId })

    expect(await signedIn.query(api.contracts.queries.forSite, { siteId })).toBeNull()
    // Still there, because what was agreed is what a disagreement is settled against.
    expect(await t.run((ctx) => ctx.db.get('contracts', contractId))).toMatchObject({ hidden: true })

    // And the house can be agreed again, which the refusal would otherwise have blocked forever.
    await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
    expect(await signedIn.query(api.contracts.queries.forSite, { siteId })).not.toBeNull()
  })

  it('will not measure a contract belonging to another house', async () => {
    const t = convexWithContracts()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    const elsewhere = await t.run(async (ctx) => {
      const person = await ctx.db.query('people').first()
      const other = await ctx.db.insert('sites', {
        name: '2-B, Phase 0',
        builtForAClient: true,
        stage: 'building',
        hidden: false,
      })
      if (person) await ctx.db.insert('siteRoles', { personId: person._id, siteId: other, capacity: 'partner' })
      return other
    })

    const refusal = await signedIn
      .mutation(api.contracts.mutations.measure, { siteId: elsewhere, contractId, actualAreaSqft: '5,250' })
      .then(() => 'nothing was refused', theWordsIn)

    expect(refusal).toBe('That contract is not on this house.')
  })
})
