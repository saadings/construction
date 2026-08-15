// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_partner'

function convexWithMilestones() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../milestones/mutations.ts': () => import('./mutations'),
    '../milestones/queries.ts': () => import('./queries'),
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

describe('the stages a contract is billed in', () => {
  it('carries no amount of its own, and follows the contract when the house is measured', async () => {
    // The whole reason nothing is stored: a re-measurement changes the contract, and every stage moves with it without being touched.
    const t = convexWithMilestones()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
    await signedIn.mutation(api.milestones.mutations.add, {
      siteId,
      contractId,
      description: 'On completion of grey structure',
      percent: '25',
    })

    const stored = await t.run((ctx) => ctx.db.query('milestones').first())
    expect(
      Object.keys(stored ?? {})
        .filter((key) => !key.startsWith('_'))
        .sort()
    ).toEqual(['contractId', 'description', 'hidden', 'percent', 'position', 'siteId'])

    const before = await signedIn.query(api.milestones.queries.forSite, { siteId })
    expect(before?.stages[0]?.amountPaisa).toBe(Math.round((2_400_00 * 5_000 * 25) / 100))

    await signedIn.mutation(api.contracts.mutations.measure, { siteId, contractId, actualAreaSqft: '5,250' })

    const after = await signedIn.query(api.milestones.queries.forSite, { siteId })
    expect(after?.stages[0]?.amountPaisa).toBe(Math.round((2_400_00 * 5_250 * 25) / 100))
  })

  it('shows what the stages add up to without insisting it is a hundred', async () => {
    // A stage nobody planned, or a re-measurement, leaves real contracts adding to something else. Refusing that would refuse the truth.
    const t = convexWithMilestones()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    for (const [description, share] of [
      ['On completion of grey structure', '25'],
      ['On completion of plaster', '40'],
      ['On handover', '20'],
    ]) {
      await signedIn.mutation(api.milestones.mutations.add, {
        siteId,
        contractId,
        description: description,
        percent: share,
      })
    }

    const read = await signedIn.query(api.milestones.queries.forSite, { siteId })

    expect(read?.percentAgreed).toBe(85)
    expect(read?.stages).toHaveLength(3)
  })

  it('reads in the order they were entered, not the order they come back', async () => {
    const t = convexWithMilestones()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    for (const description of ['First', 'Second', 'Third']) {
      await signedIn.mutation(api.milestones.mutations.add, { siteId, contractId, description, percent: '25' })
    }

    const read = await signedIn.query(api.milestones.queries.forSite, { siteId })
    expect(read?.stages.map((stage) => stage.description)).toEqual(['First', 'Second', 'Third'])
  })

  it('is billed once, and says so the second time', async () => {
    const t = convexWithMilestones()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })
    const milestoneId = await signedIn.mutation(api.milestones.mutations.add, {
      siteId,
      contractId,
      description: 'On handover',
      percent: '25',
    })

    await signedIn.mutation(api.milestones.mutations.bill, { siteId, milestoneId, billedOn: '2026-06-01' })

    const refusal = await refusalFrom(
      signedIn.mutation(api.milestones.mutations.bill, { siteId, milestoneId, billedOn: '2026-07-01' })
    )

    expect(refusal).toBe('That stage has already been billed.')
    // And the first billing stands, rather than being quietly moved.
    const read = await signedIn.query(api.milestones.queries.forSite, { siteId })
    expect(read?.stages[0]?.billedOn).toBe('2026-06-01')
  })

  it('will not take a stage against a contract on another house', async () => {
    const t = convexWithMilestones()
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

    const refusal = await refusalFrom(
      signedIn.mutation(api.milestones.mutations.add, {
        siteId: elsewhere,
        contractId,
        description: 'On handover',
        percent: '25',
      })
    )

    expect(refusal).toBe('That contract is not on this house.')
  })

  it('is not reachable on a house the caller is not a partner on', async () => {
    const t = convexWithMilestones()
    const { siteId, clientId } = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const contractId = await signedIn.mutation(api.contracts.mutations.agree, { siteId, ...aRateContract(clientId) })

    await t.run(async (ctx) => {
      const stranger = await ctx.db.insert('people', { name: 'A stranger', hidden: false })
      await ctx.db.insert('accounts', {
        externalId: 'user_stranger',
        name: 'A stranger',
        primaryEmail: 'stranger@example.com',
        otherEmails: [],
        personId: stranger,
      })
    })

    const refusal = await refusalFrom(
      t.withIdentity({ subject: 'user_stranger' }).mutation(api.milestones.mutations.add, {
        siteId,
        contractId,
        description: 'On handover',
        percent: '25',
      })
    )

    expect(refusal).toBe('This site is not one of yours.')
    expect(await t.run((ctx) => ctx.db.query('milestones').collect())).toEqual([])
    // The control: the same call from the partner lands, so this is the access check and not a broken mutation.
    await signedIn.mutation(api.milestones.mutations.add, {
      siteId,
      contractId,
      description: 'On handover',
      percent: '25',
    })
    expect(await t.run((ctx) => ctx.db.query('milestones').collect())).toHaveLength(1)
  })
})
