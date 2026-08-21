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
function convexWithPeople() {
  return convexTest(schema, { ...import.meta.glob('../**/*.*s'), '../people/queries.ts': () => import('./queries') })
}

function letIn<Answer>(answer: Answer | null): Answer {
  if (answer === null) {
    throw new Error('The ledger refused the reader this test needs.')
  }

  return answer
}

type Ledger = {
  supplier: Id<'people'>
  partner: Id<'people'>
  client: Id<'people'>
  both: Id<'people'>
  stranger: Id<'people'>
}

// One of each kind, plus the man who is both, plus somebody nothing has happened to. Every figure different, so a column reading the wrong field cannot look like a working column.
async function aLedgerWithBothSides(ctx: MutationCtx): Promise<Ledger> {
  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The one who keeps it',
    primaryEmail: 'keeper@example.com',
    otherEmails: [],
  })

  const supplier = await ctx.db.insert('people', { name: 'The steel supplier', hidden: false, phone: '0300-0000000' })
  const partner = await ctx.db.insert('people', { name: 'The one who started it', hidden: false })
  const client = await ctx.db.insert('people', { name: 'The one it is built for', hidden: false })
  const both = await ctx.db.insert('people', { name: 'The one who is both', hidden: false })
  const stranger = await ctx.db.insert('people', { name: 'Nobody has billed him', hidden: false })

  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: true,
    stage: 'building',
    hidden: false,
  })
  const trade = await ctx.db.insert('trades', { name: 'Steel', countsAsBuildingCost: true, position: 1, hidden: false })

  await ctx.db.insert('engagements', {
    siteId,
    personId: supplier,
    tradeId: trade,
    agreedPaisa: 900_000_00,
    hidden: false,
  })

  await ctx.db.insert('bills', {
    siteId,
    personId: supplier,
    tradeId: trade,
    day: '2026-02-01',
    amountPaisa: 900_000_00,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })
  await ctx.db.insert('payments', {
    siteId,
    tradeId: trade,
    day: '2026-02-05',
    amountPaisa: 350_000_00,
    paidToId: supplier,
    method: 'cheque',
    isExtraWork: false,
    removed: false,
    addedByExternalId: SIGNED_IN_AS,
  })

  for (const [fromId, why, rupees] of [
    [partner, 'partnerMoney', 2_000_000],
    [client, 'clientPayment', 1_500_000],
    [both, 'partnerMoney', 800_000],
    [both, 'clientPayment', 250_000],
  ] as const) {
    await ctx.db.insert('moneyIn', {
      siteId,
      day: '2026-02-10',
      amountPaisa: rupees * 100,
      fromId,
      why,
      method: 'transfer',
      removed: false,
      addedByExternalId: SIGNED_IN_AS,
    })
  }

  return { supplier, partner, client, both, stranger }
}

describe('the two kinds of person', () => {
  it('puts somebody we have billed on the side we pay, with what is owed', async () => {
    const t = convexWithPeople()
    const who = await t.run(aLedgerWithBothSides)

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))
    const supplier = both.weOwe.find((person) => person.personId === who.supplier)

    expect(supplier?.billedPaisa).toBe(900_000_00)
    expect(supplier?.paidPaisa).toBe(350_000_00)
    expect(supplier?.outstandingPaisa).toBe(550_000_00)
    // `Trade or role` is one column with two answers. For somebody we pay it is what he was put on.
    expect(supplier?.doing).toBe('Steel')
  })

  it('puts somebody money came from on the side that puts money in', async () => {
    const t = convexWithPeople()
    const who = await t.run(aLedgerWithBothSides)

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))

    expect(both.putIn.find((person) => person.personId === who.partner)?.inPaisa).toBe(2_000_000_00)
    expect(both.putIn.find((person) => person.personId === who.client)?.inPaisa).toBe(1_500_000_00)

    // Most in first: the man who has funded the most is the one asked about.
    expect(both.putIn[0]?.personId).toBe(who.partner)
  })

  it('says what somebody is from what his money was, because nothing stores a side', async () => {
    const t = convexWithPeople()
    const who = await t.run(aLedgerWithBothSides)

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))

    expect(both.putIn.find((person) => person.personId === who.partner)?.role).toBe('partner')
    expect(both.putIn.find((person) => person.personId === who.client)?.role).toBe('client')

    // No `siteRoles` row exists for any of them -- and that is not a gap in the fixture, it is what his real ledger looks like. The pill comes from what each receipt was said to be.
  })

  it('calls the man who is both a partner, which is the stronger of the two', async () => {
    const t = convexWithPeople()
    const who = await t.run(aLedgerWithBothSides)

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))
    const him = both.putIn.find((person) => person.personId === who.both)

    // On his own house a man is partner and client at once. One card, one pill, and his money is one figure.
    expect(him?.role).toBe('partner')
    expect(him?.inPaisa).toBe(1_050_000_00)
  })

  it('leaves somebody nothing has happened to off both lists, and still hands him over', async () => {
    const t = convexWithPeople()
    const who = await t.run(aLedgerWithBothSides)

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))

    // Neither side: nobody has billed him and no money has come from him. He is still somebody the screen has to be able to correct or take off the list.
    expect(both.weOwe.map((person) => person.personId)).not.toContain(who.stranger)
    expect(both.putIn.map((person) => person.personId)).not.toContain(who.stranger)
    expect(both.everyone.map((person) => person._id)).toContain(who.stranger)
  })

  it('sums each heading from the rows under it rather than from a second reading', async () => {
    const t = convexWithPeople()
    await t.run(aLedgerWithBothSides)

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))

    expect(both.owedPaisa).toBe(550_000_00)
    expect(both.inPaisa).toBe(4_550_000_00)
    expect(both.inPaisa).toBe(both.putIn.reduce((total, person) => total + person.inPaisa, 0))
  })

  it('counts nobody twice and nothing that was taken back out', async () => {
    const t = convexWithPeople()
    const who = await t.run(aLedgerWithBothSides)

    await t.run(async (ctx) => {
      const gone = await ctx.db
        .query('moneyIn')
        .filter((q) => q.eq(q.field('fromId'), who.client))
        .first()

      if (gone !== null) await ctx.db.patch('moneyIn', gone._id, { removed: true })
    })

    const both = letIn(await t.withIdentity({ subject: SIGNED_IN_AS }).query(api.people.queries.bothSides, {}))

    // A receipt taken back out takes its person off the list with it, where it was the only one.
    expect(both.putIn.map((person) => person.personId)).not.toContain(who.client)
    expect(both.inPaisa).toBe(3_050_000_00)
  })

  it('answers nothing at all to a sign-in the ledger does not know', async () => {
    const t = convexWithPeople()
    await t.run(aLedgerWithBothSides)

    expect(await t.withIdentity({ subject: 'user_nobody_here' }).query(api.people.queries.bothSides, {})).toBeNull()
  })
})
