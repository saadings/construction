// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_partner'

function convexWithBills() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../bills/queries.ts': () => import('./queries'),
    '../bills/mutations.ts': () => import('./mutations'),
  })
}

type AHouse = { siteId: Id<'sites'>; mason: Id<'people'>; trade: Id<'trades'> }

async function aHouseWithSomebodyOnIt(ctx: MutationCtx): Promise<AHouse> {
  const mason = await ctx.db.insert('people', { name: 'A mason', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  const trade = await ctx.db.insert('trades', {
    name: 'Civil labour',
    countsAsBuildingCost: true,
    position: 1,
    hidden: false,
  })

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  return { siteId, mason, trade }
}

const signedIn = (t: ReturnType<typeof convexWithBills>) => t.withIdentity({ subject: SIGNED_IN_AS })

describe('what has been billed to a house', () => {
  it('reads each one in the words the screen shows, newest first', async () => {
    const t = convexWithBills()
    const at = await t.run(aHouseWithSomebodyOnIt)

    await signedIn(t).mutation(api.bills.mutations.raise, {
      siteId: at.siteId,
      personId: at.mason,
      tradeId: at.trade,
      day: '2026-04-01',
      amount: '300,000',
      reference: 'CH-11',
    })
    await signedIn(t).mutation(api.bills.mutations.raise, {
      siteId: at.siteId,
      personId: at.mason,
      tradeId: at.trade,
      day: '2026-04-09',
      amount: '40,000',
      description: 'The extra room',
    })

    const read = await signedIn(t).query(api.bills.queries.forSite, { siteId: at.siteId })

    expect(read?.map((one) => one.amountPaisa)).toEqual([40_000_00, 300_000_00])
    expect(read?.[0]).toMatchObject({
      day: '2026-04-09',
      personName: 'A mason',
      tradeName: 'Civil labour',
      description: 'The extra room',
    })
    expect(read?.[1]?.reference).toBe('CH-11')
  })

  it('leaves out one that was taken back out', async () => {
    const t = convexWithBills()
    const at = await t.run(aHouseWithSomebodyOnIt)

    const billId = await signedIn(t).mutation(api.bills.mutations.raise, {
      siteId: at.siteId,
      personId: at.mason,
      tradeId: at.trade,
      day: '2026-04-01',
      amount: '300,000',
    })

    expect(await signedIn(t).query(api.bills.queries.forSite, { siteId: at.siteId })).toHaveLength(1)

    await signedIn(t).mutation(api.bills.mutations.remove, { siteId: at.siteId, billId })

    expect(await signedIn(t).query(api.bills.queries.forSite, { siteId: at.siteId })).toEqual([])
    // Hidden rather than erased, and signed: somebody disputing a bill is the case this record is kept for.
    const taken = await t.run((ctx) => ctx.db.get('bills', billId))
    expect(taken).toMatchObject({ removed: true, changedByExternalId: SIGNED_IN_AS })
    expect(typeof taken?.changedAt).toBe('number')
  })

  it('reads only this house, and nothing at all for one that is not there', async () => {
    const t = convexWithBills()
    const at = await t.run(aHouseWithSomebodyOnIt)

    await signedIn(t).mutation(api.bills.mutations.raise, {
      siteId: at.siteId,
      personId: at.mason,
      tradeId: at.trade,
      day: '2026-04-01',
      amount: '300,000',
    })

    const elsewhere = await t.run((ctx) =>
      ctx.db.insert('sites', { name: '2-B, Phase 0', builtForAClient: false, stage: 'building', hidden: false })
    )
    // A house with nothing billed on it: an empty list rather than nothing at all.
    expect(await signedIn(t).query(api.bills.queries.forSite, { siteId: elsewhere })).toEqual([])

    const gone = await t.run(async (ctx) => {
      await ctx.db.delete('sites', elsewhere)
      return elsewhere
    })
    expect(await signedIn(t).query(api.bills.queries.forSite, { siteId: gone })).toBeNull()

    // The control: this house still reads, so the two answers above are about those houses and not about a broken query.
    expect(await signedIn(t).query(api.bills.queries.forSite, { siteId: at.siteId })).toHaveLength(1)
  })
})
