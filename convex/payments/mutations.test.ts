// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { sameName } from '../../shared/validation/person'
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
    name: '1-A, Phase 0',
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
  })

  const bankAccountId = await ctx.db.insert('bankAccounts', {
    label: 'Bank 0000',
    lastFourDigits: '0000',
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
    method: 'cheque' as const,
    reference: '0001',
    bankAccountId: site.bankAccountId,
    ...over,
  }
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

    expect(refusal).toBe('Add the cheque number.')
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
    ).toBe('Add the cheque number.')

    expect(
      await refusalFrom(
        signedIn.mutation(api.payments.mutations.record, {
          siteId: site.siteId,
          entries: [aCheque(site, { method: 'transfer', reference: undefined, bankAccountId: undefined })],
        })
      )
    ).toBe('Say which account this left.')

    // The control: cash needs neither, and must go straight through.
    await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { method: 'cash', reference: undefined, bankAccountId: undefined })],
    })
    expect(await t.run((ctx) => ctx.db.query('payments').collect())).toHaveLength(1)
  })

  it('takes a payment on any house in the ledger, not only the one you started', async () => {
    // One partnership, one set of books. A house somebody else started is not somebody else's house.
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)
    const elsewhere = await t.run((ctx) =>
      ctx.db.insert('sites', { name: '2-B, Phase 0', builtForAClient: false, stage: 'building', hidden: false })
    )

    await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.payments.mutations.record, { siteId: elsewhere, entries: [aCheque(site)] })

    expect(await t.run((ctx) => ctx.db.query('payments').collect())).toHaveLength(1)
  })

  it('refuses a payment on a house that is not in the ledger, and writes nothing', async () => {
    // What the old rule was also quietly doing: without this, a mistyped id writes payments into nothing.
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)
    const gone = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert('sites', {
        name: '3-C, Phase 0',
        builtForAClient: false,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.delete('sites', siteId)
      return siteId
    })

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.payments.mutations.record, {
        siteId: gone,
        entries: [aCheque(site)],
      })
    )

    expect(refusal).toBe('That house is not in the ledger.')
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
        name: '2-B, Phase 0',
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

    expect(refusal).toBe('That payment is not on this site.')
    expect(await t.run((ctx) => ctx.db.get('payments', paymentId))).toMatchObject({ removed: false })
  })
})

describe('a name typed on the day sheet rather than picked', () => {
  it('points at the person already called that, rather than making a second of him', async () => {
    // The people screen refuses two rows under one name. This was the door that did not: a name typed here inserted regardless, and two rows for one man split his money across both.
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { paidToId: undefined, newPerson: 'A steel supplier', amount: '40,000' })],
    })

    // Typed again, spelt the way somebody in a hurry spells it.
    await signedIn.mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { paidToId: undefined, newPerson: '  a steel   supplier ', amount: '10,000' })],
    })

    const everyone = await t.run((ctx) => ctx.db.query('people').collect())
    expect(everyone.filter((person) => sameName(person.name, 'A steel supplier'))).toHaveLength(1)

    // And both payments point at the one row, so what he is owed is one figure rather than two halves.
    const payments = await t.run((ctx) => ctx.db.query('payments').collect())
    expect(new Set(payments.map((payment) => payment.paidToId)).size).toBe(1)
  })

  it('points at somebody taken off the list without putting them back on it', async () => {
    // Hiding somebody is a decision about the list. It is not a statement that they were never paid.
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)
    const hidden = await t.run((ctx) => ctx.db.insert('people', { name: 'A retired mason', hidden: true }))

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { paidToId: undefined, newPerson: 'A retired mason', amount: '5,000' })],
    })

    const payments = await t.run((ctx) => ctx.db.query('payments').collect())
    expect(payments.map((payment) => payment.paidToId)).toEqual([hidden])
    expect(await t.run((ctx) => ctx.db.get('people', hidden))).toMatchObject({ hidden: true })
  })

  it('still makes a person of a name nobody has used before', async () => {
    // The control. Reusing what is there must not become refusing to write anything new.
    const t = convexWithPayments()
    const site = await t.run(aSiteThePartnerIsOn)

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.payments.mutations.record, {
      siteId: site.siteId,
      entries: [aCheque(site, { paidToId: undefined, newPerson: 'A hardware shop', amount: '2,000' })],
    })

    const everyone = await t.run((ctx) => ctx.db.query('people').collect())
    expect(everyone.map((person) => person.name)).toContain('A hardware shop')
  })
})
