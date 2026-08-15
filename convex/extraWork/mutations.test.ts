// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_partner'

// A refusal crosses the wire as JSON, so `data` arrives with its quotes still on. Compared whole rather than by a fragment, which passes just as happily on a sentence wrapped, cut short, or stuck to something else.
function theWordsIn(thrown: unknown): string {
  if (!(thrown instanceof ConvexError)) {
    return 'thrown as something a phone never sees'
  }

  const carried = String(thrown.data)
  try {
    const decoded: unknown = JSON.parse(carried)
    return typeof decoded === 'string' ? decoded : carried
  } catch {
    return carried
  }
}

function convexWithExtraWork() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../extraWork/mutations.ts': () => import('./mutations'),
    '../extraWork/queries.ts': () => import('./queries'),
  })
}

async function aHouseBuiltForAClient(ctx: MutationCtx): Promise<Id<'sites'>> {
  const partner = await ctx.db.insert('people', { name: 'The partner', hidden: false })
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

  return siteId
}

// A real shape of line: a lintel worked out on site, and a rate against running feet.
const aBill = {
  raisedOn: '2026-04-02',
  description: 'Lintel over the car porch, not in the drawings',
  lines: [
    {
      description: 'Lintel concrete',
      working: "39.75' x 0.375' x 11'",
      quantity: '164',
      unit: 'cft',
      ratePaisa: '420',
    },
    { description: 'Steel for it', quantity: '2.5', unit: 'maund', ratePaisa: '11,800' },
  ],
}

describe('work that was outside the contract', () => {
  it('adds its lines up on every read and stores no total', async () => {
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.extraWork.mutations.raise, { siteId, ...aBill })

    // No total on the bill and no amount on a line: both are the multiplication, done on reading.
    const storedBill = await t.run((ctx) => ctx.db.query('extraWorkBills').first())
    expect(
      Object.keys(storedBill ?? {})
        .filter((key) => !key.startsWith('_'))
        .sort()
    ).toEqual(['addedByExternalId', 'description', 'raisedOn', 'removed', 'siteId'])

    const storedLine = await t.run((ctx) => ctx.db.query('extraWorkBillLines').first())
    expect(Object.keys(storedLine ?? {}).some((key) => key.toLowerCase().includes('amount'))).toBe(false)

    // `siteQuery` answers null to someone who may not open the house, so the reading is taken through that rather than around it.
    const [read] = (await signedIn.query(api.extraWork.queries.forSite, { siteId })) ?? []
    expect(read?.totalPaisa).toBe(Math.round(164 * 420_00) + Math.round(2.5 * 11_800_00))
  })

  it('keeps the working exactly as it was written on site', async () => {
    // `39.75' x 0.375' x 11'` is what makes the bill defensible to a client. Re-deriving it would only ever disagree with the man who measured it.
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.extraWork.mutations.raise, { siteId, ...aBill })
    const [read] = (await signedIn.query(api.extraWork.queries.forSite, { siteId })) ?? []

    expect(read?.lines[0]?.working).toBe("39.75' x 0.375' x 11'")
    // And a line worked out in someone's head carries none, which is not an error.
    expect(read?.lines[1]?.working).toBeUndefined()
  })

  it('reads its lines in the order they were entered', async () => {
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    await signedIn.mutation(api.extraWork.mutations.raise, { siteId, ...aBill })
    const [read] = (await signedIn.query(api.extraWork.queries.forSite, { siteId })) ?? []

    expect(read?.lines.map((line) => line.description)).toEqual(['Lintel concrete', 'Steel for it'])
  })

  it('refuses a bill with nothing on it', async () => {
    // A figure with nothing behind it is exactly what this table replaces.
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)

    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.extraWork.mutations.raise, { siteId, ...aBill, lines: [] })
      .then(() => 'nothing was refused', theWordsIn)

    expect(refusal).toBe('Put in at least one line of what was done.')
    expect(await t.run((ctx) => ctx.db.query('extraWorkBills').collect())).toEqual([])
  })

  it('writes no bill when one of its lines is refused', async () => {
    // All of them or none. A bill that landed with two of its three lines is worse than one that never landed.
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)

    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.extraWork.mutations.raise, {
        siteId,
        ...aBill,
        lines: [aBill.lines[0], { ...aBill.lines[1], quantity: 'nonsense' }],
      })
      .then(() => 'nothing was refused', theWordsIn)

    expect(refusal).toBe('Put in how much of it there was.')
    expect(await t.run((ctx) => ctx.db.query('extraWorkBills').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('extraWorkBillLines').collect())).toEqual([])
  })

  it.each([
    // A rate below nothing would put a line on the bill that reduces what the client owes, on a bill raised to charge him more.
    ['a rate below nothing', { ratePaisa: '-420' }, 'Put in an amount greater than nothing.'],
    // Zero is refused a step earlier, by the rule every amount goes through. Its sentence is written for a payment and reads oddly on a rate, which is a wording matter and not a hole.
    ['a rate of nothing', { ratePaisa: '0' }, 'Put in how much was paid.'],
  ])('refuses a line at %s', async (_case, wrong, said) => {
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)

    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.extraWork.mutations.raise, { siteId, ...aBill, lines: [{ ...aBill.lines[0], ...wrong }] })
      .then(() => 'nothing was refused', theWordsIn)

    expect(refusal).toBe(said)
    expect(await t.run((ctx) => ctx.db.query('extraWorkBills').collect())).toEqual([])
  })

  it('leaves a bill taken back out of the reading, without erasing it', async () => {
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)
    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })

    const billId = await signedIn.mutation(api.extraWork.mutations.raise, { siteId, ...aBill })
    await signedIn.mutation(api.extraWork.mutations.takeBack, { siteId, billId })

    expect(await signedIn.query(api.extraWork.queries.forSite, { siteId })).toEqual([])
    // Still there, and signed, because the argument it settles is about what was agreed.
    const kept = await t.run((ctx) => ctx.db.get('extraWorkBills', billId))
    expect(kept).toMatchObject({ removed: true, changedByExternalId: SIGNED_IN_AS })
  })

  it('is reachable by anybody signed in, holding no role on the house', async () => {
    const t = convexWithExtraWork()
    const siteId = await t.run(aHouseBuiltForAClient)

    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: 'user_stranger',
        name: 'Another partner',
        primaryEmail: 'another@example.com',
        otherEmails: [],
      })
    })

    // One partnership, one set of books: a sign-in with no person and no role raises a bill on any house in it.
    await t.withIdentity({ subject: 'user_stranger' }).mutation(api.extraWork.mutations.raise, { siteId, ...aBill })

    expect(await t.run((ctx) => ctx.db.query('extraWorkBills').collect())).toHaveLength(1)
    // And it is still the door: somebody not signed in at all writes nothing.
    await expect(t.mutation(api.extraWork.mutations.raise, { siteId, ...aBill })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('extraWorkBills').collect())).toHaveLength(1)
  })
})
