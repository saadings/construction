// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { sameName } from '../../shared/validation/person'
import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

// Five doors can now write a row into `people`, where two could before. Nauman asked for it -- "same should happen for all of the other stuff as well" -- and the reason it was refused for so long is real: **two rows for one man split his money across both, and every figure about him is then wrong and quietly so.**

// `personAlreadyCalled` is what stops that, and it only stops it at the doors that call it. So this asks the same question of every one of them, from outside, rather than trusting that each remembered.

const SIGNED_IN_AS = 'user_partner'

function convexWithEverything() {
  return convexTest(schema, import.meta.glob('../**/*.*s'))
}

type AHouse = { siteId: Id<'sites'>; tradeId: Id<'trades'>; masonId: Id<'people'> }

async function aHouseWithSomebodyOnIt(ctx: MutationCtx): Promise<AHouse> {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const masonId = await ctx.db.insert('people', { name: 'A steel supplier', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })
  const tradeId = await ctx.db.insert('trades', {
    name: 'Civil labour',
    countsAsBuildingCost: true,
    position: 1,
    hidden: false,
  })

  await ctx.db.insert('siteRoles', { personId: partner, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  return { siteId, tradeId, masonId }
}

/** Every way this app can name somebody while writing something else down, and what each one is called on the screen that does it. */
const EVERY_DOOR = [
  {
    said: 'the day sheet',
    open: (house: AHouse, newPerson: string) => ({
      door: api.payments.mutations.record,
      asked: {
        siteId: house.siteId,
        entries: [
          {
            tradeId: house.tradeId,
            day: '2026-04-02',
            amount: '25,000',
            newPerson,
            method: 'cash' as const,
            isExtraWork: false,
          },
        ],
      },
    }),
  },
  {
    said: 'money coming in',
    open: (house: AHouse, newPerson: string) => ({
      door: api.moneyIn.mutations.record,
      asked: {
        siteId: house.siteId,
        day: '2026-04-02',
        amount: '250,000',
        newPerson,
        why: 'partnerMoney' as const,
        method: 'cash' as const,
      },
    }),
  },
  {
    said: 'putting somebody on a trade',
    open: (house: AHouse, newPerson: string) => ({
      door: api.engagements.mutations.agree,
      asked: { siteId: house.siteId, tradeId: house.tradeId, newPerson, agreed: '300,000' },
    }),
  },
  {
    said: 'somebody has billed us',
    open: (house: AHouse, newPerson: string) => ({
      door: api.bills.mutations.raise,
      asked: { siteId: house.siteId, tradeId: house.tradeId, day: '2026-04-02', amount: '40,000', newPerson },
    }),
  },
  {
    said: 'agreeing a contract',
    open: (house: AHouse, newPerson: string) => ({
      door: api.contracts.mutations.agree,
      asked: {
        siteId: house.siteId,
        newPerson,
        agreedOn: '2026-03-14',
        priced: { how: 'lumpSum' as const, totalPaisa: '12,500,000' },
        agreedAreaSqft: '2,250',
      },
    }),
  },
  {
    said: 'agreeing the shares',
    open: (house: AHouse, newPerson: string) => ({
      door: api.profitShares.mutations.agree,
      asked: { siteId: house.siteId, agreedOn: '2026-03-14', shares: [{ newPerson, share: '100' }] },
    }),
  },
]

describe('a name typed rather than picked', () => {
  it.each(EVERY_DOOR)('makes a person of a name nobody has used, from $said', async ({ open }) => {
    const t = convexWithEverything()
    const house = await t.run(aHouseWithSomebodyOnIt)
    const { door, asked } = open(house, 'A new plumber')

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(door, asked)

    const everyone = await t.run((ctx) => ctx.db.query('people').collect())
    expect(everyone.filter((person) => sameName(person.name, 'A new plumber'))).toHaveLength(1)
  })

  it.each(EVERY_DOOR)('points at the person already called that, from $said', async ({ open }) => {
    // The whole reason typing a name is safe. Spelt the way somebody in a hurry spells it: different case, doubled spaces, a space at each end.
    const t = convexWithEverything()
    const house = await t.run(aHouseWithSomebodyOnIt)
    const { door, asked } = open(house, '  a steel   SUPPLIER ')

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(door, asked)

    const everyone = await t.run((ctx) => ctx.db.query('people').collect())
    expect(everyone.filter((person) => sameName(person.name, 'A steel supplier'))).toHaveLength(1)
  })

  it('is asked of every door this app really has', () => {
    // The floor. A list that stopped being kept up would report a clean sweep of the doors it still remembers, which is exactly how the two that could do this were the only two for so long.
    expect(EVERY_DOOR).toHaveLength(6)
  })
})
