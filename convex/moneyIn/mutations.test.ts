// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { sameName } from '../../shared/validation/person'
import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'
const SOMEBODY_ELSE = 'user_who_is_not_on_this_house'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithMoneyIn() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../moneyIn/mutations.ts': () => import('./mutations'),
    '../moneyIn/queries.ts': () => import('./queries'),
  })
}

type Site = {
  siteId: Id<'sites'>
  partner: Id<'people'>
  client: Id<'people'>
  bankAccountId: Id<'bankAccounts'>
}

async function aSiteThePartnerIsOn(ctx: MutationCtx): Promise<Site> {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const client = await ctx.db.insert('people', { name: 'The one it is built for', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId: partner, siteId, capacity: 'partner' })
  // A client holds a role so the money reads correctly. It never lets anyone in, and a test below holds that.
  await ctx.db.insert('siteRoles', { personId: client, siteId, capacity: 'client' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  return {
    siteId,
    partner,
    client,
    bankAccountId: await ctx.db.insert('bankAccounts', {
      label: 'Second account',
      lastFourDigits: '4242',
      hidden: false,
    }),
  }
}

function aCheque(site: Site, over: Record<string, unknown> = {}) {
  return {
    siteId: site.siteId,
    day: '2025-10-07',
    amount: '2,500,000',
    fromId: site.client,
    why: 'clientPayment' as const,
    method: 'cheque' as const,
    reference: '0001',
    bankAccountId: site.bankAccountId,
    ...over,
  }
}

// What a phone would be shown. `convex-test` hands the thrown value back as it crossed the wire, where a sentence is JSON -- quotes and all -- so the sentence inside is what is compared.
function theSentenceIn(data: unknown): string {
  const asItCrossed = String(data)

  return asItCrossed.startsWith('"') ? (JSON.parse(asItCrossed) as string) : asItCrossed
}

// A refusal that was not a `ConvexError` reaches a phone as "Server Error" and says nothing, so it is named here rather than compared.
async function refusalFrom(promise: Promise<unknown>) {
  return await promise.then(
    () => 'nothing was refused',
    (thrown: unknown) =>
      thrown instanceof ConvexError ? theSentenceIn(thrown.data) : 'thrown as something a phone never sees'
  )
}

describe('writing down money that came in', () => {
  it('stores rupees as whole paisa, signed by whoever put it in', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const receiptId = await signedIn.mutation(api.moneyIn.mutations.record, aCheque(site, { amount: '2,500,000.50' }))

    const receipt = await t.run((ctx) => ctx.db.get('moneyIn', receiptId))
    expect(receipt?.amountPaisa).toBe(250000050)
    // The day is a day, not a moment, so it reads the same on every phone in every timezone.
    expect(receipt?.day).toBe('2025-10-07')
    expect(receipt?.addedByExternalId).toBe(SIGNED_IN_AS)
    expect(receipt?.removed).toBe(false)
  })

  it('asks a cheque coming in for its number, in words a phone can show', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const refusal = await refusalFrom(
      signedIn.mutation(api.moneyIn.mutations.record, aCheque(site, { reference: undefined }))
    )

    expect(refusal).toBe('Add the cheque number.')
  })

  it('lets cash in without an account, because cash lands in none', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const receiptId = await signedIn.mutation(
      api.moneyIn.mutations.record,
      aCheque(site, { method: 'cash', reference: undefined, bankAccountId: undefined })
    )

    const receipt = await t.run((ctx) => ctx.db.get('moneyIn', receiptId))
    expect(receipt?.bankAccountId).toBeUndefined()
  })

  // A buyer is nobody in the ledger until the day he pays.
  it('makes a person out of a name typed once at the sale', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const receiptId = await signedIn.mutation(
      api.moneyIn.mutations.record,
      aCheque(site, { fromId: undefined, newPerson: '  Who   bought it ', why: 'sale' })
    )

    const written = await t.run(async (ctx) => {
      const receipt = await ctx.db.get('moneyIn', receiptId)
      return receipt === null ? null : { receipt, from: await ctx.db.get('people', receipt.fromId) }
    })
    expect(written?.from?.name).toBe('Who bought it')
    // What the money is was asked, not worked out from anything: this receipt came from a man holding no role on the house at all.
    expect(written?.receipt.why).toBe('sale')
  })

  it('will not take money from nobody at all', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const refusal = await refusalFrom(
      signedIn.mutation(api.moneyIn.mutations.record, aCheque(site, { fromId: undefined }))
    )

    expect(refusal).toBe('Say who this came from.')
  })

  it('takes it from anybody signed in, holding no role on the house', async () => {
    // One partnership, one set of books. What the sign-in list lets in is what may write here.
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: SOMEBODY_ELSE,
        name: 'Another partner',
        primaryEmail: 'another@example.com',
        otherEmails: [],
      })
    })

    await t.withIdentity({ subject: SOMEBODY_ELSE }).mutation(api.moneyIn.mutations.record, aCheque(site))

    expect(await t.run((ctx) => ctx.db.query('moneyIn').collect())).toHaveLength(1)
    // And the door is still a door: not signed in at all writes nothing.
    await expect(t.mutation(api.moneyIn.mutations.record, aCheque(site))).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('moneyIn').collect())).toHaveLength(1)
  })
})

describe('taking money back out of the ledger', () => {
  it('hides it and signs the removal, rather than erasing it', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const receiptId = await signedIn.mutation(api.moneyIn.mutations.record, aCheque(site))
    await signedIn.mutation(api.moneyIn.mutations.remove, { siteId: site.siteId, moneyInId: receiptId })

    const receipt = await t.run((ctx) => ctx.db.get('moneyIn', receiptId))
    // Still there to settle an argument with, which is the whole point of not deleting it.
    expect(receipt).not.toBeNull()
    expect(receipt?.removed).toBe(true)
    expect(receipt?.changedByExternalId).toBe(SIGNED_IN_AS)
    expect(typeof receipt?.changedAt).toBe('number')

    const standing = await signedIn.query(api.moneyIn.queries.forSite, { siteId: site.siteId })
    expect(standing).toHaveLength(0)
  })

  it('will not remove a receipt belonging to another house', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)
    const other = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert('sites', {
        name: '2-B, Phase 0',
        builtForAClient: true,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.insert('siteRoles', { personId: site.partner, siteId, capacity: 'partner' })
      return siteId
    })

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const receiptId = await signedIn.mutation(api.moneyIn.mutations.record, aCheque(site))

    // The caller is a partner on both houses, so what refuses this is the receipt not being on the house named, not the door.
    const refusal = await refusalFrom(
      signedIn.mutation(api.moneyIn.mutations.remove, { siteId: other, moneyInId: receiptId })
    )

    expect(refusal).toBe('That money is not on this site.')
    expect(await t.run((ctx) => ctx.db.get('moneyIn', receiptId))).toMatchObject({ removed: false })
  })
})

describe('a name typed on the money coming in screen rather than picked', () => {
  it('points at the partner already called that, so his capital is one figure', async () => {
    // Worse here than anywhere. Money in as `partnerMoney` is capital, and capital is what the whole profit split is worked out from -- a partner split across two rows has his share worked out from half his money.
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    await signedIn.mutation(
      api.moneyIn.mutations.record,
      aCheque(site, { fromId: undefined, newPerson: 'the   PARTNER', why: 'partnerMoney', amount: '600,000' })
    )

    const everyone = await t.run((ctx) => ctx.db.query('people').collect())
    expect(everyone.filter((person) => sameName(person.name, 'The partner'))).toHaveLength(1)

    // And it is the row that was already there, so what he has put in is read as one figure.
    const receipts = await t.run((ctx) => ctx.db.query('moneyIn').collect())
    expect(receipts.map((one) => one.fromId)).toEqual([site.partner])
  })

  it('points at somebody taken off the list without putting them back on it', async () => {
    const t = convexWithMoneyIn()
    const site = await t.run(aSiteThePartnerIsOn)
    const gone = await t.run((ctx) => ctx.db.insert('people', { name: 'A former buyer', hidden: true }))

    await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.moneyIn.mutations.record, aCheque(site, { fromId: undefined, newPerson: 'A former buyer' }))

    const receipts = await t.run((ctx) => ctx.db.query('moneyIn').collect())
    expect(receipts.map((one) => one.fromId)).toEqual([gone])
    expect(await t.run((ctx) => ctx.db.get('people', gone))).toMatchObject({ hidden: true })
  })
})
