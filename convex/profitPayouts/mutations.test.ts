// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

// A partner taking his share out, paid part by cheque and part in cash. Nauman asked for the split and chose separate rows; what this holds is that both rows land or neither does.

// There was no test file here at all until the split: `record` was reachable only from a screen, and the screen was the only thing that had ever called it.

const SIGNED_IN_AS = 'user_partner'

// Every figure here is distinct and none is the sum or difference of two others. `200,000 + 100,000 = 300,000` would be three figures that each mean something else in a fixture, and a check can then pass because two unrelated numbers happen to agree -- which has already happened once in this repository.
const CHEQUE_HALF = '175,000'
const CASH_HALF = '42,000'

// The glob is relative to this file, and a module in this directory is not matched by `../**` from inside it: named here the way every other suite in this repository names its own.
function convexWithPayouts() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../profitPayouts/mutations.ts': () => import('./mutations'),
  })
}

type AHouse = { siteId: Id<'sites'>; partner: Id<'people'>; bankAccountId: Id<'bankAccounts'> }

async function aHouseAPartnerIsOn(ctx: MutationCtx): Promise<AHouse> {
  const partner = await ctx.db.insert('people', { name: 'The one who started it', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  const bankAccountId = await ctx.db.insert('bankAccounts', {
    label: 'Bank 4021',
    lastFourDigits: '4021',
    hidden: false,
  })

  await ctx.db.insert('siteRoles', { personId: partner, siteId, capacity: 'partner' })
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The one who started it',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  return { siteId, partner, bankAccountId }
}

describe('paying a partner his share out', () => {
  it('writes one row for each way it went, sharing who and when', async () => {
    const t = convexWithPayouts()
    const house = await t.run(aHouseAPartnerIsOn)

    await t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.profitPayouts.mutations.record, {
      siteId: house.siteId,
      payouts: [
        {
          personId: house.partner,
          day: '2026-07-23',
          amount: CHEQUE_HALF,
          method: 'cheque',
          reference: '4471',
          bankAccountId: house.bankAccountId,
        },
        { personId: house.partner, day: '2026-07-23', amount: CASH_HALF, method: 'cash' },
      ],
    })

    const written = await t.run((ctx) => ctx.db.query('profitPayouts').collect())

    expect(written).toHaveLength(2)
    expect([...written.map((row) => row.amountPaisa)].sort((one, other) => one - other)).toEqual([
      4_200_000, 17_500_000,
    ])
    expect(new Set(written.map((row) => row.personId)).size).toBe(1)
    expect(new Set(written.map((row) => row.day)).size).toBe(1)

    // Each carries what its own way of paying asks for, and nothing the other's way asks for.
    const byCheque = written.find((row) => row.method === 'cheque')
    const inCash = written.find((row) => row.method === 'cash')
    expect(byCheque?.reference).toBe('4471')
    expect(byCheque?.bankAccountId).toBe(house.bankAccountId)
    expect(inCash?.reference).toBeUndefined()
    expect(inCash?.bankAccountId).toBeUndefined()
  })

  it('writes neither half when one of them is refused', async () => {
    // What this proves and what it does not, said plainly: a refusal anywhere in the list writes nothing, because a mutation is one transaction. It cannot prove the screen sent one call rather than two -- what makes that true is the shape of the argument, which is a list and has no single-row form to reach for.

    // Planted while it was written: moving the check inside the loop leaves this passing, because the rollback is Convex's rather than the order's. Worth knowing before anybody reads it as proof of the ordering.
    const t = convexWithPayouts()
    const house = await t.run(aHouseAPartnerIsOn)

    await expect(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.profitPayouts.mutations.record, {
        siteId: house.siteId,
        payouts: [
          { personId: house.partner, day: '2026-07-23', amount: CASH_HALF, method: 'cash' },
          // A cheque with no number: refused by the same rule the screen asks from.
          { personId: house.partner, day: '2026-07-23', amount: CHEQUE_HALF, method: 'cheque' },
        ],
      })
    ).rejects.toThrow()

    expect(await t.run((ctx) => ctx.db.query('profitPayouts').collect())).toHaveLength(0)
  })

  it('refuses a payout with no ways of paying in it at all', async () => {
    const t = convexWithPayouts()
    const house = await t.run(aHouseAPartnerIsOn)

    await expect(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.profitPayouts.mutations.record, {
        siteId: house.siteId,
        payouts: [],
      })
    ).rejects.toThrow()
  })
})
