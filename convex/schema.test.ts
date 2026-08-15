import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import schema from './schema'
import { CANONICAL_TRADES } from './trades/seed'

async function aSite(ctx: MutationCtx, name: string): Promise<Id<'sites'>> {
  return await ctx.db.insert('sites', { name, builtForAClient: false, stage: 'building', hidden: false })
}

describe('the shape the money lives in', () => {
  it('lets one person be different things on different sites', async () => {
    // A mason puts money into one site and sells steel to another. A role column on the person cannot say that.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    await t.run(async (ctx) => {
      const personId = await ctx.db.insert('people', { name: 'A mason', hidden: false })
      const investing = await aSite(ctx, '359-R, Phase 7')
      const supplying = await aSite(ctx, '478-R, Phase 7')

      await ctx.db.insert('siteRoles', { personId, siteId: investing, capacity: 'investor' })
      await ctx.db.insert('siteRoles', { personId, siteId: supplying, capacity: 'partner' })

      const held = await ctx.db
        .query('siteRoles')
        .withIndex('byPerson', (q) => q.eq('personId', personId))
        .collect()

      expect(held.map((role) => role.capacity).sort()).toEqual(['investor', 'partner'])
    })
  })

  it('keeps a payment as whole paisa and a day, never a moment', async () => {
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    await t.run(async (ctx) => {
      const siteId = await aSite(ctx, '359-R, Phase 7')
      const tradeId = await ctx.db.insert('trades', {
        name: 'Cement',
        countsAsBuildingCost: true,
        position: 3,
        hidden: false,
      })
      const paidById = await ctx.db.insert('people', { name: 'The partner', hidden: false })

      const paymentId = await ctx.db.insert('payments', {
        siteId,
        tradeId,
        paidById,
        day: '2025-10-07',
        amountPaisa: 4915000,
        method: 'cheque',
        reference: '0001',
        isExtraWork: false,
        removed: false,
        addedByExternalId: 'user_nauman',
      })

      const payment = await ctx.db.get('payments', paymentId)

      expect(Number.isInteger(payment?.amountPaisa)).toBe(true)
      expect(payment?.day).toBe('2025-10-07')
    })
  })

  it('finds the payments of one site without reading every payment there has ever been', async () => {
    // Ten years of one site is a few thousand rows; without this index every total walks the whole table.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    await t.run(async (ctx) => {
      const siteId = await aSite(ctx, '359-R, Phase 7')
      const other = await aSite(ctx, '478-R, Phase 7')
      const tradeId = await ctx.db.insert('trades', {
        name: 'Cement',
        countsAsBuildingCost: true,
        position: 3,
        hidden: false,
      })
      const paidById = await ctx.db.insert('people', { name: 'The partner', hidden: false })

      for (const day of ['2025-10-05', '2025-10-06', '2025-10-07']) {
        await ctx.db.insert('payments', {
          siteId,
          tradeId,
          paidById,
          day,
          amountPaisa: 1000,
          method: 'cash',
          isExtraWork: false,
          removed: false,
          addedByExternalId: 'user_nauman',
        })
      }

      // The control: another site's payment must not be swept in by the same index.
      await ctx.db.insert('payments', {
        siteId: other,
        tradeId,
        paidById,
        day: '2025-10-07',
        amountPaisa: 9999,
        method: 'cash',
        isExtraWork: false,
        removed: false,
        addedByExternalId: 'user_nauman',
      })

      const found = await ctx.db
        .query('payments')
        .withIndex('bySiteAndDay', (q) => q.eq('siteId', siteId))
        .collect()

      expect(found).toHaveLength(3)
    })
  })

  it('tells building cost apart from the cost of the land', async () => {
    // The sheets summed every column then subtracted one back out by hand, so a trade added at the end broke it silently.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    const { building, land } = await t.run(async (ctx) => {
      const siteId = await aSite(ctx, '359-R, Phase 7')
      const paidById = await ctx.db.insert('people', { name: 'The partner', hidden: false })

      const tradeIds = new Map<string, Id<'trades'>>()
      for (const [position, trade] of CANONICAL_TRADES.entries()) {
        tradeIds.set(trade.name, await ctx.db.insert('trades', { ...trade, position, hidden: false }))
      }

      // The plot arrives as three payments to three people. Splitting it must leave the two totals exactly where they were.
      const spend: Array<[string, number]> = [
        ['Cement', 257048100],
        ['Bricks', 183920000],
        ['Plot', 4000000000],
        ['Plot taxes and transfer fees', 100000000],
        ['Dealer commission', 47500000],
      ]

      for (const [name, amountPaisa] of spend) {
        const tradeId = tradeIds.get(name)
        if (!tradeId) throw new Error(`The seeded list has no trade called ${name}`)

        await ctx.db.insert('payments', {
          siteId,
          tradeId,
          paidById,
          day: '2025-10-07',
          amountPaisa,
          method: 'cheque',
          isExtraWork: false,
          removed: false,
          addedByExternalId: 'user_nauman',
        })
      }

      const payments = await ctx.db
        .query('payments')
        .withIndex('bySiteAndDay', (q) => q.eq('siteId', siteId))
        .collect()

      let building = 0
      let land = 0
      for (const payment of payments) {
        const trade = await ctx.db.get('trades', payment.tradeId)
        if (trade?.countsAsBuildingCost) building += payment.amountPaisa
        else land += payment.amountPaisa
      }

      return { building, land }
    })

    // 2,570,481 + 1,839,200 from the workbooks. The plot must not be in it.
    expect(building).toBe(440968100)
    // 41,475,000, the same figure the single plot column held before it became three.
    expect(land).toBe(4147500000)
  })

  it('keeps who took a payment out of the ledger, and when', async () => {
    // Partners disagreeing about money is the reason this exists. A removal nobody signed is the case it turns on.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    const removed = await t.run(async (ctx) => {
      const siteId = await aSite(ctx, '359-R, Phase 7')
      const tradeId = await ctx.db.insert('trades', {
        name: 'Cement',
        countsAsBuildingCost: true,
        position: 3,
        hidden: false,
      })
      const paidById = await ctx.db.insert('people', { name: 'The partner', hidden: false })
      const bankAccountId = await ctx.db.insert('bankAccounts', {
        label: 'Bank 0000',
        lastFourDigits: '2192',
        hidden: false,
      })

      const paymentId = await ctx.db.insert('payments', {
        siteId,
        tradeId,
        paidById,
        bankAccountId,
        day: '2025-10-07',
        amountPaisa: 4915000,
        method: 'cheque',
        reference: '0001',
        isExtraWork: false,
        removed: false,
        addedByExternalId: 'user_nauman',
      })

      await ctx.db.patch('payments', paymentId, {
        removed: true,
        changedByExternalId: 'user_partner',
        changedAt: 1_760_000_000_000,
      })

      return await ctx.db.get('payments', paymentId)
    })

    expect(removed?.removed).toBe(true)
    expect(removed?.changedByExternalId).toBe('user_partner')
    expect(removed?.changedAt).toBe(1_760_000_000_000)
    // Who added it is still there. A removal must not overwrite the first signature.
    expect(removed?.addedByExternalId).toBe('user_nauman')
  })

  it('stores a bank account already masked, so nothing has to remember to mask it', async () => {
    // A partner may screenshot any screen. The digits that are not stored cannot leak from one careless component.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    const account = await t.run(async (ctx) => {
      const id = await ctx.db.insert('bankAccounts', {
        label: 'Bank 0000',
        lastFourDigits: '2192',
        hidden: false,
      })
      return await ctx.db.get('bankAccounts', id)
    })

    expect(account?.lastFourDigits).toMatch(/^\d{4}$/)
    // The point is not that the mask is applied but that there is nowhere to put the rest of the number.
    expect(
      Object.keys(account ?? {})
        .filter((key) => !key.startsWith('_'))
        .sort()
    ).toEqual(['hidden', 'label', 'lastFourDigits'])
  })

  it('joins a sign-in to the person it belongs to', async () => {
    // Signing in resolves to an account; reach resolves to a person holding a role. Without this field the two never meet.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    const reached = await t.run(async (ctx) => {
      const personId = await ctx.db.insert('people', { name: 'The partner', hidden: false })
      const siteId = await aSite(ctx, '359-R, Phase 7')
      await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })

      await ctx.db.insert('accounts', {
        externalId: 'user_nauman',
        name: 'The partner',
        primaryEmail: 'nauman@example.com',
        otherEmails: [],
        personId,
      })

      const account = await ctx.db
        .query('accounts')
        .withIndex('byExternalId', (q) => q.eq('externalId', 'user_nauman'))
        .unique()
      const whoIsSigningIn = account?.personId
      if (!whoIsSigningIn) return []

      return await ctx.db
        .query('siteRoles')
        .withIndex('bySiteAndPerson', (q) => q.eq('siteId', siteId).eq('personId', whoIsSigningIn))
        .collect()
    })

    expect(reached.map((role) => role.capacity)).toEqual(['partner'])
  })

  it('leaves a fresh sign-in attached to nobody', async () => {
    // The control. Signing in proves who someone is; it must not be what says which sites they may open.
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))

    const account = await t.run(async (ctx) => {
      const id = await ctx.db.insert('accounts', {
        externalId: 'user_stranger',
        name: 'A Stranger',
        primaryEmail: 'stranger@example.com',
        otherEmails: [],
      })
      return await ctx.db.get('accounts', id)
    })

    expect(account?.personId).toBeUndefined()
  })
})
