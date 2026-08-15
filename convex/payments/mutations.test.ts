// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_nauman'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithPayments() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../payments/mutations.ts': () => import('./mutations'),
    '../payments/queries.ts': () => import('./queries'),
  })
}

type Site = {
  siteId: Id<'sites'>
  nauman: Id<'people'>
  bankAccountId: Id<'bankAccounts'>
  cement: Id<'trades'>
  bricks: Id<'trades'>
  plot: Id<'trades'>
  supervision: Id<'trades'>
}

async function aSiteThePartnerIsOn(ctx: MutationCtx): Promise<Site> {
  const nauman = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '359-R, Phase 7',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId: nauman, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'nauman@example.com',
    otherEmails: [],
    personId: nauman,
  })

  const bankAccountId = await ctx.db.insert('bankAccounts', {
    label: 'Bank 0000',
    lastFourDigits: '2192',
    hidden: false,
  })

  const trade = async (name: string, countsAsBuildingCost: boolean, position: number) =>
    await ctx.db.insert('trades', { name, countsAsBuildingCost, position, hidden: false })

  return {
    siteId,
    nauman,
    bankAccountId,
    cement: await trade('Cement', true, 1),
    bricks: await trade('Bricks', true, 2),
    plot: await trade('Plot', false, 3),
    // The workbook left this out of its own headline figure. Here it is a trade like any other.
    supervision: await trade('Supervision charges', true, 4),
  }
}

function aCheque(site: Site, over: Record<string, unknown> = {}) {
  return {
    tradeId: site.cement,
    day: '2025-10-07',
    amount: '49,150',
    paidToId: site.nauman,
    paidById: site.nauman,
    method: 'cheque' as const,
    reference: '0001',
    bankAccountId: site.bankAccountId,
    ...over,
  }
}

async function refusalFrom(promise: Promise<unknown>) {
  return await promise.then(
    () => 'nothing was refused',
    (thrown: unknown) =>
      thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
  )
}

describe('putting a day of payments in', () => {
  it('stores rupees as whole paisa', async () => {
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const [paymentId] = await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { amount: '49,150.50' })],
    })

    const payment = await t.run((ctx) => ctx.db.get('payments', paymentId))
    expect(payment?.amountPaisa).toBe(4915050)
    // The day is a day, not a moment, so it reads the same on every phone in every timezone.
    expect(payment?.day).toBe('2025-10-07')
    expect(payment?.addedByExternalId).toBe(SIGNED_IN_AS)
  })

  it('writes eight trades in one sitting, all of them or none', async () => {
    // One cheque run on a Tuesday touching eight trades. A half-saved day is the thing three disagreeing files were made of.
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const refusal = await refusalFrom(
      signedIn.mutation(api.payments.mutations.record, {
        siteId: site.siteId,
        entries: [
          aCheque(site),
          aCheque(site, { tradeId: site.bricks, amount: '18,392' }),
          // The eighth is wrong. Nothing before it may survive.
          aCheque(site, { tradeId: site.plot, method: 'cheque', reference: undefined }),
        ],
      })
    )

    expect(refusal).toContain('Add the cheque number.')
    expect(await t.run((ctx) => ctx.db.query('payments').collect())).toEqual([])
  })

  it('makes a person out of a name typed once, in the same write', async () => {
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const [paymentId] = await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { paidToId: undefined, newPerson: '  A supplier  ' })],
    })

    const payment = await t.run((ctx) => ctx.db.get('payments', paymentId))
    const paidToId = payment?.paidToId
    const paidTo = paidToId ? await t.run((ctx) => ctx.db.get('people', paidToId)) : null
    expect(paidTo?.name).toBe('A supplier')
  })

  it('will not take a cheque without its number, or a transfer without an account', async () => {
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    expect(
      await refusalFrom(
        signedIn.mutation(api.payments.mutations.record, {
          siteId: site.siteId,
          entries: [aCheque(site, { reference: undefined })],
        })
      )
    ).toContain('Add the cheque number.')

    expect(
      await refusalFrom(
        signedIn.mutation(api.payments.mutations.record, {
          siteId: site.siteId,
          entries: [aCheque(site, { method: 'transfer', reference: undefined, bankAccountId: undefined })],
        })
      )
    ).toContain('Say which account this left.')

    // The control: cash needs neither, and must go straight through.
    await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { method: 'cash', reference: undefined, bankAccountId: undefined })],
    })
    expect(await t.run((ctx) => ctx.db.query('payments').collect())).toHaveLength(1)
  })

  it('refuses a payment on a site that is not one of yours', async () => {
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)
    const elsewhere = await t.run((ctx) =>
      ctx.db.insert('sites', { name: '478-R, Phase 7', builtForAClient: false, stage: 'building', hidden: false })
    )

    const refusal = await refusalFrom(
      t
        .withIdentity({ subject: SIGNED_IN_AS })
        .mutation(api.payments.mutations.record, { siteId: elsewhere, entries: [aCheque(site)] })
    )

    expect(refusal).toContain('not one of yours')
    expect(await t.run((ctx) => ctx.db.query('payments').collect())).toEqual([])
  })
})

describe('taking a payment back out', () => {
  it('signs the removal and keeps who put it in', async () => {
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const [paymentId] = await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site)],
    })

    await t.withIdentity({ subject: 'user_partner' }).run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_partner',
        name: 'A Partner',
        primaryEmail: 'partner@example.com',
        otherEmails: [],
        personId: site.nauman,
      })
    })
    await t.withIdentity({ subject: 'user_partner' }).mutation(api.payments.mutations.remove, {
      siteId: site.siteId,
      paymentId,
    })

    const payment = await t.run((ctx) => ctx.db.get('payments', paymentId))
    expect(payment?.removed).toBe(true)
    expect(payment?.changedByExternalId).toBe('user_partner')
    expect(payment?.changedAt).toBeGreaterThan(0)
    // The first signature survives. A removal must not overwrite who put it in.
    expect(payment?.addedByExternalId).toBe(SIGNED_IN_AS)
  })

  it('cannot reach a payment belonging to another site', async () => {
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const [paymentId] = await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site)],
    })

    const otherSite = await t.run(async (ctx) => {
      const id = await ctx.db.insert('sites', {
        name: '478-R, Phase 7',
        builtForAClient: false,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.insert('siteRoles', { personId: site.nauman, siteId: id, capacity: 'partner' })
      return id
    })

    // A partner on both sites, naming one site and one of the other's payments.
    const refusal = await refusalFrom(
      signedIn.mutation(api.payments.mutations.remove, { siteId: otherSite, paymentId })
    )

    expect(refusal).toContain('not on this site')
    expect(await t.run((ctx) => ctx.db.get('payments', paymentId))).toMatchObject({ removed: false })
  })
})
