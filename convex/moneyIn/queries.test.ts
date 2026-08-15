// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithMoneyIn() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../moneyIn/queries.ts': () => import('./queries'),
    '../moneyIn/mutations.ts': () => import('./mutations'),
  })
}

type House = { siteId: Id<'sites'>; partner: Id<'people'>; client: Id<'people'> }

// A site query answers nothing at all when the site is not the caller's, so a test that meant to be let in says so here rather than reading figures off a refusal.
function letIn<Answer>(answer: Answer | null): Answer {
  if (answer === null) {
    throw new Error('The site refused the reader this test needs.')
  }

  return answer
}

// A house built for somebody: the partner has put 2,000,000 of his own in, the client has paid 5,500,000 against it, and it has not been sold.
async function aHouseWithMoneyIn(ctx: MutationCtx): Promise<House> {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const client = await ctx.db.insert('people', { name: 'The one it is built for', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId: partner, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  const arriving = [
    { day: '2025-08-01', rupees: 2000000, fromId: partner, why: 'partnerMoney' as const },
    { day: '2025-09-15', rupees: 3000000, fromId: client, why: 'clientPayment' as const },
    { day: '2025-10-20', rupees: 2500000, fromId: client, why: 'clientPayment' as const },
  ]

  for (const { day, rupees, fromId, why } of arriving) {
    await ctx.db.insert('moneyIn', {
      siteId,
      day,
      amountPaisa: rupees * 100,
      fromId,
      why,
      method: 'transfer',
      removed: false,
      addedByExternalId: SIGNED_IN_AS,
    })
  }

  return { siteId, partner, client }
}

describe('what came in on a house', () => {
  it('reads newest first, with the name behind each one', async () => {
    const t = convexWithMoneyIn()
    const house = await t.run(aHouseWithMoneyIn)

    const arrived = letIn(
      await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.moneyIn.queries.forSite, { siteId: house.siteId })
    )

    expect(arrived.map((one) => one.day)).toEqual(['2025-10-20', '2025-09-15', '2025-08-01'])
    expect(arrived.map((one) => one.fromName)).toEqual([
      'The one it is built for',
      'The one it is built for',
      'The partner',
    ])
  })

  // A cheque run puts several receipts on one day, which is exactly when he is reading this against a cheque book. Two lists differing only in the order the rows went in must read the same, or the same screen says two different things on two days.
  it('reads the same however the rows went in', async () => {
    const twoOnOneDay = [
      { amountPaisa: 40000000, why: 'clientPayment' as const },
      { amountPaisa: 90000000, why: 'partnerMoney' as const },
    ]

    const asRead = []
    for (const order of [twoOnOneDay, [...twoOnOneDay].reverse()]) {
      const t = convexWithMoneyIn()
      const house = await t.run(async (ctx) => {
        const built = await aHouseWithMoneyIn(ctx)
        for (const receipt of order) {
          await ctx.db.insert('moneyIn', {
            siteId: built.siteId,
            day: '2025-10-20',
            amountPaisa: receipt.amountPaisa,
            fromId: built.client,
            why: receipt.why,
            method: 'cheque',
            reference: '0001',
            removed: false,
            addedByExternalId: SIGNED_IN_AS,
          })
        }
        return built
      })

      const arrived = letIn(
        await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.moneyIn.queries.forSite, { siteId: house.siteId })
      )
      asRead.push(arrived.map((one) => `${one.day} ${one.amountPaisa} ${one.fromName}`))
    }

    expect(asRead[0]).toEqual(asRead[1])
    // And the order itself, so this cannot pass by both readings being wrong in the same way.
    expect(asRead[0].slice(0, 3)).toEqual([
      '2025-10-20 250000000 The one it is built for',
      '2025-10-20 90000000 The one it is built for',
      '2025-10-20 40000000 The one it is built for',
    ])
  })

  it('splits the total by what the money is, and every part adds up to it', async () => {
    const t = convexWithMoneyIn()
    const house = await t.run(aHouseWithMoneyIn)

    const totals = letIn(
      await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.moneyIn.queries.totals, { siteId: house.siteId })
    )

    expect(totals.byWhy.partnerMoney).toBe(200000000)
    expect(totals.byWhy.clientPayment).toBe(550000000)
    // Nothing has been sold, and a reason with nothing under it has to read as zero rather than go missing.
    expect(totals.byWhy.sale).toBe(0)
    expect(totals.receivedPaisa).toBe(750000000)
  })

  // The sale is what the role cannot tell you: the partner who put his own money in is also the man being paid for the house.
  it('keeps a partner’s own money apart from what he is paid for the house', async () => {
    const t = convexWithMoneyIn()
    const house = await t.run(aHouseWithMoneyIn)
    await t.run(async (ctx) => {
      await ctx.db.insert('moneyIn', {
        siteId: house.siteId,
        day: '2025-11-01',
        amountPaisa: 100000000,
        fromId: house.partner,
        why: 'sale',
        method: 'payOrder',
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
    })

    const totals = letIn(
      await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.moneyIn.queries.totals, { siteId: house.siteId })
    )

    // Both figures came from the same person on the same house. Only what was asked at the time tells them apart.
    expect(totals.byWhy.partnerMoney).toBe(200000000)
    expect(totals.byWhy.sale).toBe(100000000)
    // Every reason is in the whole. A sum that quietly leaves one out is the workbook's own mistake.
    expect(totals.receivedPaisa).toBe(850000000)
  })

  it('leaves out what was taken back out of the ledger', async () => {
    const t = convexWithMoneyIn()
    const house = await t.run(aHouseWithMoneyIn)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const first = letIn(await signedIn.query(api.moneyIn.queries.forSite, { siteId: house.siteId }))
    await signedIn.mutation(api.moneyIn.mutations.remove, { siteId: house.siteId, moneyInId: first[0]._id })

    const totals = letIn(await signedIn.query(api.moneyIn.queries.totals, { siteId: house.siteId }))
    expect(totals.byWhy.clientPayment).toBe(300000000)
    expect(totals.receivedPaisa).toBe(500000000)
  })

  it('counts only the house asked about', async () => {
    const t = convexWithMoneyIn()
    const house = await t.run(aHouseWithMoneyIn)
    const other = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert('sites', {
        name: '2-B, Phase 0',
        builtForAClient: false,
        stage: 'building',
        hidden: false,
      })
      await ctx.db.insert('siteRoles', { personId: house.partner, siteId, capacity: 'partner' })
      await ctx.db.insert('moneyIn', {
        siteId,
        day: '2025-10-01',
        amountPaisa: 4500000,
        fromId: house.partner,
        why: 'partnerMoney',
        method: 'cash',
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })
      return siteId
    })

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    expect(letIn(await signedIn.query(api.moneyIn.queries.totals, { siteId: house.siteId })).receivedPaisa).toBe(
      750000000
    )
    expect(letIn(await signedIn.query(api.moneyIn.queries.totals, { siteId: other })).receivedPaisa).toBe(4500000)
  })

  it('shows it to anybody signed in, and nothing for a house that is not there', async () => {
    const t = convexWithMoneyIn()
    const house = await t.run(aHouseWithMoneyIn)
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_another_partner',
        name: 'Another partner',
        primaryEmail: 'another@example.com',
        otherEmails: [],
      })
    })

    const alsoSignedIn = t.withIdentity({ subject: 'user_another_partner' })
    expect(letIn(await alsoSignedIn.query(api.moneyIn.queries.forSite, { siteId: house.siteId }))).toHaveLength(3)

    // A house that is not there is still nothing, which is what a mistyped or hidden id gets.
    const gone = await t.run(async (ctx) => {
      await ctx.db.delete('sites', house.siteId)
      return house.siteId
    })
    expect(await alsoSignedIn.query(api.moneyIn.queries.forSite, { siteId: gone })).toBeNull()
  })
})
