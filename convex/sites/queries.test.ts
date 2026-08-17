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
function convexWithSites() {
  return convexTest(schema, { ...import.meta.glob('../**/*.*s'), '../sites/queries.ts': () => import('./queries') })
}

function letIn<Answer>(answer: Answer | null): Answer {
  if (answer === null) {
    throw new Error('The ledger refused the reader this test needs.')
  }

  return answer
}

// Two houses: one built for somebody, with money out and money in, and one of the partnership's own with nothing on it yet.
async function twoHouses(ctx: MutationCtx): Promise<{ forAClient: Id<'sites'>; ours: Id<'sites'> }> {
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })

  const client = await ctx.db.insert('people', { name: 'The one it is built for', hidden: false })
  const trade = await ctx.db.insert('trades', {
    name: 'Civil labour',
    countsAsBuildingCost: true,
    position: 1,
    hidden: false,
  })

  const forAClient = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
    coveredAreaSqft: 5400,
    startedOn: '2026-01-04',
  })
  await ctx.db.insert('siteRoles', { personId: client, siteId: forAClient, capacity: 'client' })

  const ours = await ctx.db.insert('sites', {
    name: '204-C, Phase 6',
    builtForAClient: false,
    stage: 'planning',
    hidden: false,
  })

  await ctx.db.insert('payments', {
    siteId: forAClient,
    day: '2026-02-01',
    amountPaisa: 300_000_00,
    tradeId: trade,
    method: 'cash',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })

  // Taken back out, so it counts nowhere: a removal that comes off one figure and not the other is a card whose own two numbers disagree.
  await ctx.db.insert('payments', {
    siteId: forAClient,
    day: '2026-02-02',
    amountPaisa: 50_000_00,
    tradeId: trade,
    method: 'cash',
    isExtraWork: false,
    removed: true,
    addedByExternalId: SIGNED_IN_AS,
  })

  await ctx.db.insert('moneyIn', {
    siteId: forAClient,
    day: '2026-02-03',
    amountPaisa: 900_000_00,
    fromId: client,
    why: 'clientPayment',
    method: 'transfer',
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })
  await ctx.db.insert('moneyIn', {
    siteId: forAClient,
    day: '2026-02-04',
    amountPaisa: 25_000_00,
    fromId: client,
    why: 'clientPayment',
    method: 'transfer',
    removed: true,
    addedByExternalId: SIGNED_IN_AS,
  })

  return { forAClient, ours }
}

describe('every house on the home screen', () => {
  it('carries what a card says: what has gone out, what has come in, and who it is for', async () => {
    const t = convexWithSites()
    const houses = await t.run(twoHouses)

    const all = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.sites.queries.all, {}))
    const one = all.find((site) => site._id === houses.forAClient)

    expect(one?.spentPaisa).toBe(300_000_00)
    expect(one?.receivedPaisa).toBe(900_000_00)
    expect(one?.clientName).toBe('The one it is built for')

    // The two figures are different numbers on purpose: a card reading the wrong one looks exactly like a working card when they match.
    expect(one?.spentPaisa).not.toBe(one?.receivedPaisa)
  })

  it('leaves out what was taken back out, on both figures', async () => {
    const t = convexWithSites()
    const houses = await t.run(twoHouses)

    const all = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.sites.queries.all, {}))
    const one = all.find((site) => site._id === houses.forAClient)

    // 350,000 was paid and 50,000 of it taken back; 925,000 came in and 25,000 of it taken back.
    expect(one?.spentPaisa).toBe(300_000_00)
    expect(one?.receivedPaisa).toBe(900_000_00)
  })

  it('says nothing about a client where there is none, rather than an empty name', async () => {
    const t = convexWithSites()
    const houses = await t.run(twoHouses)

    const all = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.sites.queries.all, {}))
    const ours = all.find((site) => site._id === houses.ours)

    // A house of the partnership's own has nobody it is built for. Absent, not `''`: a card cannot tell an empty string from a client whose name nobody typed.
    expect(ours?.clientName).toBeUndefined()
    expect(ours?.spentPaisa).toBe(0)
    expect(ours?.receivedPaisa).toBe(0)
  })

  it('carries the area and the day it started, which were on the house all along', async () => {
    const t = convexWithSites()
    const houses = await t.run(twoHouses)

    const all = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.sites.queries.all, {}))

    // Both optional and both already in the schema. They were reported as a data gap because the screen's own type does not mention them, which is what reading a summary as the document looks like.
    expect(all.find((site) => site._id === houses.forAClient)?.coveredAreaSqft).toBe(5400)
    expect(all.find((site) => site._id === houses.forAClient)?.startedOn).toBe('2026-01-04')
    expect(all.find((site) => site._id === houses.ours)?.coveredAreaSqft).toBeUndefined()
  })

  it('answers nothing at all to a sign-in the ledger does not know', async () => {
    const t = convexWithSites()
    await t.run(twoHouses)

    // Not an empty list, which reads as a ledger with no houses in it.
    expect(await t.withIdentity({ subject: 'user_nobody_here' }).query(api.sites.queries.all, {})).toBeNull()
  })
})
