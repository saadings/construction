// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_nauman'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithBankAccounts() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../bankAccounts/mutations.ts': () => import('./mutations'),
    '../bankAccounts/queries.ts': () => import('./queries'),
  })
}

// A partner on a site. Bank accounts are global, so what the wrapper asks is whether this is a partner at all.
async function anAccount(ctx: MutationCtx) {
  const personId = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
  })
}

describe('adding a bank account', () => {
  it('has nowhere to put anything but the last four digits', async () => {
    // The screen promises "only the last four figures leave this phone". This holds the stored document to it, and the mutation's arguments to it as well.

    // The label carries no digits of its own on purpose: sharing them with the last four would let a swapped or derived value pass unnoticed.
    const t = convexWithBankAccounts()
    await t.run(anAccount)

    const bankAccountId = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.bankAccounts.mutations.add, { label: '  Second   account ', lastFourDigits: '4242' })

    const stored = await t.run((ctx) => ctx.db.get('bankAccounts', bankAccountId))

    expect(stored?.label).toBe('Second account')
    expect(stored?.lastFourDigits).toBe('4242')
    // The property is that there is nowhere to put a full number, not that something remembers to mask one.
    expect(
      Object.keys(stored ?? {})
        .filter((key) => !key.startsWith('_'))
        .sort()
    ).toEqual(['hidden', 'label', 'lastFourDigits'])
  })

  it('cannot be handed a whole account number', async () => {
    // The client takes the last four before it sends. If a caller ever sends more, the server refuses rather than storing what it was given.
    const t = convexWithBankAccounts()
    await t.run(anAccount)

    const refusal = await refusalFrom(
      t
        .withIdentity({ subject: SIGNED_IN_AS })
        .mutation(api.bankAccounts.mutations.add, { label: 'Bank 0000', lastFourDigits: '55555555550000' })
    )

    expect(refusal).toBe('That is not the last four figures of an account.')
    expect(await t.run((ctx) => ctx.db.query('bankAccounts').collect())).toEqual([])
  })

  it('turns away a caller who is not signed in', async () => {
    const t = convexWithBankAccounts()

    await expect(
      t.mutation(api.bankAccounts.mutations.add, { label: 'Bank 0000', lastFourDigits: '0000' })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('bankAccounts').collect())).toEqual([])
  })

  it('drops a hidden account from the list, without deleting it', async () => {
    const t = convexWithBankAccounts()
    await t.run(anAccount)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const bankAccountId = await signedIn.mutation(api.bankAccounts.mutations.add, {
      label: 'Bank 0000',
      lastFourDigits: '0000',
    })
    await signedIn.mutation(api.bankAccounts.mutations.hide, { bankAccountId })

    expect(await signedIn.query(api.bankAccounts.queries.list, {})).toEqual([])
    // A payment already points at it, so it stays where it is.
    expect(await t.run((ctx) => ctx.db.get('bankAccounts', bankAccountId))).toMatchObject({ hidden: true })
  })
})
