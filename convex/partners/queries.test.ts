// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_who_keeps_the_ledger'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithPartners() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../partners/queries.ts': () => import('./queries'),
  })
}

type House = { siteId: Id<'sites'>; one: Id<'people'>; other: Id<'people'>; client: Id<'people'> }

// One house, two partners. One put in 6,000,000 and the other 2,000,000; the client has paid 12,000,000 and the house has cost 8,500,000. So the profit is 3,500,000 and nothing has gone back to anybody yet.
async function aHouseTwoPartnersPutInto(ctx: MutationCtx): Promise<House> {
  const one = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const other = await ctx.db.insert('people', { name: 'Another partner', hidden: false })
  const client = await ctx.db.insert('people', { name: 'The one it is built for', hidden: false })

  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  const arriving = [
    { fromId: one, rupees: 60_000, why: 'partnerMoney' as const },
    { fromId: other, rupees: 20_000, why: 'partnerMoney' as const },
    { fromId: client, rupees: 120_000, why: 'clientPayment' as const },
  ]
  for (const { fromId, rupees, why } of arriving) {
    await ctx.db.insert('moneyIn', {
      siteId,
      day: '2025-09-01',
      amountPaisa: rupees * 100,
      fromId,
      why,
      method: 'transfer',
      removed: false,
      addedByExternalId: SIGNED_IN_AS,
    })
  }

  const tradeId = await ctx.db.insert('trades', {
    name: 'Civil labour',
    countsAsBuildingCost: true,
    position: 1,
    hidden: false,
  })
  await ctx.db.insert('payments', {
    siteId,
    tradeId,
    paidById: one,
    paidToId: other,
    day: '2025-10-01',
    amountPaisa: 85_000 * 100,
    method: 'cash',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })

  return { siteId, one, other, client }
}

function letIn<Answer>(answer: Answer | null): Answer {
  if (answer === null) {
    throw new Error('The house refused the reader this test needs.')
  }

  return answer
}

async function positionsOn(t: ReturnType<typeof convexWithPartners>, siteId: Id<'sites'>) {
  return letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.partners.queries.positions, { siteId }))
}

describe('what a house has made', () => {
  it('counts the client and the sale, and never the funding', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)

    const read = await positionsOn(t, house.siteId)

    // 120,000 from the client. The 80,000 the partners put in is funding, and counting it would make a house look profitable the moment somebody funded it.
    expect(read.broughtInPaisa).toBe(12_000_000)
    expect(read.spentPaisa).toBe(8_500_000)
    expect(read.profitPaisa).toBe(3_500_000)
  })
})

describe('what each partner is owed', () => {
  it('follows what each of them put in until somebody says otherwise', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)

    const read = await positionsOn(t, house.siteId)

    expect(read.sharesAgreed).toBe(false)
    expect(read.positions.map((position) => [position.name, position.capitalPaisa, position.basisPoints])).toEqual([
      ['The partner', 6_000_000, 7_500],
      ['Another partner', 2_000_000, 2_500],
    ])
    // Three quarters and a quarter of 3,500,000.
    expect(read.positions.map((position) => position.duePaisa)).toEqual([2_625_000, 875_000])
  })

  it('follows what was agreed instead, which is the whole point of agreeing it', async () => {
    // Nauman asked for this twice. Who funded a house and who agreed to take the profit are not always the same people.
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.profitShares.mutations.agree, {
      siteId: house.siteId,
      agreedOn: '2025-09-02',
      shares: [
        { personId: house.one, share: '50' },
        { personId: house.other, share: '50' },
      ],
    })

    const read = await positionsOn(t, house.siteId)

    expect(read.sharesAgreed).toBe(true)
    expect(read.positions.map((position) => position.basisPoints)).toEqual([5_000, 5_000])
    expect(read.positions.map((position) => position.duePaisa)).toEqual([1_750_000, 1_750_000])
  })

  it('goes back to following the money when the agreement is taken away', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.profitShares.mutations.agree, {
      siteId: house.siteId,
      agreedOn: '2025-09-02',
      shares: [
        { personId: house.one, share: '50' },
        { personId: house.other, share: '50' },
      ],
    })
    await signedIn.mutation(api.profitShares.mutations.followTheMoney, { siteId: house.siteId })

    const read = await positionsOn(t, house.siteId)

    expect(read.sharesAgreed).toBe(false)
    expect(read.positions.map((position) => position.basisPoints)).toEqual([7_500, 2_500])
  })

  it('refuses a set of shares that does not come to the whole, and names the house and the gap', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.profitShares.mutations.agree, {
        siteId: house.siteId,
        agreedOn: '2025-09-02',
        shares: [
          { personId: house.one, share: '50' },
          { personId: house.other, share: '49' },
        ],
      })
    )

    expect(refusal).toBe('Those shares are 1% short of the whole on 1-A, Phase 0. They have to come to 100%.')
    // And nothing was written, so a house is never left holding a whole that does not add up.
    expect(await t.run((ctx) => ctx.db.query('profitShares').collect())).toEqual([])
  })

  it('refuses the same when they come to more than the whole', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.profitShares.mutations.agree, {
        siteId: house.siteId,
        agreedOn: '2025-09-02',
        shares: [
          { personId: house.one, share: '60' },
          { personId: house.other, share: '50' },
        ],
      })
    )

    expect(refusal).toBe('Those shares are 10% more than the whole on 1-A, Phase 0. They have to come to 100%.')
  })

  it('refuses one person put down twice, which is a share counted twice', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.profitShares.mutations.agree, {
        siteId: house.siteId,
        agreedOn: '2025-09-02',
        shares: [
          { personId: house.one, share: '50' },
          { personId: house.one, share: '50' },
        ],
      })
    )

    expect(refusal).toBe('Somebody is down twice. Put each person in once.')
  })

  it('adds every share back up to the whole profit, to the last paisa', async () => {
    // Three equal partners on a profit that does not divide by three. Paisa lost in rounding are paisa somebody is owed.
    const t = convexWithPartners()
    const house = await t.run(async (ctx) => {
      const built = await aHouseTwoPartnersPutInto(ctx)
      const third = await ctx.db.insert('people', { name: 'A third partner', hidden: false })

      await ctx.db.insert('moneyIn', {
        siteId: built.siteId,
        day: '2025-09-03',
        amountPaisa: 1,
        fromId: built.client,
        why: 'clientPayment',
        method: 'cash',
        removed: false,
        addedByExternalId: SIGNED_IN_AS,
      })

      return { ...built, third }
    })

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    await signedIn.mutation(api.profitShares.mutations.agree, {
      siteId: house.siteId,
      agreedOn: '2025-09-02',
      shares: [
        { personId: house.one, share: '33.34' },
        { personId: house.other, share: '33.33' },
        { personId: house.third, share: '33.33' },
      ],
    })

    const read = await positionsOn(t, house.siteId)
    const due = read.positions.reduce((sum, position) => sum + position.duePaisa, 0)

    expect(read.profitPaisa).toBe(3_500_001)
    expect(due).toBe(3_500_001)
  })
})

describe('what has gone back to a partner', () => {
  it('is what he has been paid out, and what is left is the difference', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.profitPayouts.mutations.record, {
      siteId: house.siteId,
      personId: house.one,
      day: '2025-11-01',
      amount: '20,000',
      method: 'cash',
    })

    const read = await positionsOn(t, house.siteId)
    const [first] = read.positions

    expect(first.duePaisa).toBe(2_625_000)
    expect(first.paidPaisa).toBe(2_000_000)
    expect(first.balancePaisa).toBe(625_000)
  })

  it('is not a cost of the house, so paying a partner does not make the house dearer', async () => {
    // The reason this is not a payment. A share going back is not what the house cost.
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const before = await positionsOn(t, house.siteId)
    await signedIn.mutation(api.profitPayouts.mutations.record, {
      siteId: house.siteId,
      personId: house.one,
      day: '2025-11-01',
      amount: '20,000',
      method: 'cash',
    })
    const after = await positionsOn(t, house.siteId)

    expect(after.spentPaisa).toBe(before.spentPaisa)
    expect(after.profitPaisa).toBe(before.profitPaisa)
  })

  it('drops out of the figure when it is taken back out, and is still there', async () => {
    const t = convexWithPartners()
    const house = await t.run(aHouseTwoPartnersPutInto)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const payoutId = await signedIn.mutation(api.profitPayouts.mutations.record, {
      siteId: house.siteId,
      personId: house.one,
      day: '2025-11-01',
      amount: '20,000',
      method: 'cash',
    })
    await signedIn.mutation(api.profitPayouts.mutations.remove, { siteId: house.siteId, payoutId })

    const read = await positionsOn(t, house.siteId)

    expect(read.positions[0].paidPaisa).toBe(0)
    expect(await t.run((ctx) => ctx.db.get('profitPayouts', payoutId))).toMatchObject({ removed: true })
  })
})

describe('a house that has not made anything yet', () => {
  it('owes nobody a share of a loss', async () => {
    // Half way through a build, everything is out and nothing is in. Nauman asked for a share of profit; a share of a loss is not a thing anybody agreed to.
    const t = convexWithPartners()
    const house = await t.run(async (ctx) => {
      const built = await aHouseTwoPartnersPutInto(ctx)
      const client = await ctx.db
        .query('moneyIn')
        .withIndex('bySiteAndDay', (q) => q.eq('siteId', built.siteId))
        .collect()

      for (const one of client) {
        if (one.why === 'clientPayment') await ctx.db.patch('moneyIn', one._id, { removed: true })
      }

      return built
    })

    const read = await positionsOn(t, house.siteId)

    expect(read.profitPaisa).toBe(-8_500_000)
    expect(read.positions.map((position) => position.duePaisa)).toEqual([0, 0])
    // What each of them put in is still there to read, which is the figure that matters while a house is being built.
    expect(read.positions.map((position) => position.capitalPaisa)).toEqual([6_000_000, 2_000_000])
  })
})
