// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

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

async function anAccount(ctx: MutationCtx) {
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
    const t = convexWithBankAccounts()
    await t.run(anAccount)

    const bankAccountId = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.bankAccounts.mutations.add, { label: '  Bank   0000 ', lastFourDigits: '0000' })

    const stored = await t.run((ctx) => ctx.db.get('bankAccounts', bankAccountId))

    expect(stored?.label).toBe('Bank 0000')
    expect(stored?.lastFourDigits).toBe('0000')
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

    const refusal = await t
      .withIdentity({ subject: SIGNED_IN_AS })
      .mutation(api.bankAccounts.mutations.add, { label: 'Bank 0000', lastFourDigits: '55555555550000' })
      .then(
        () => 'nothing was refused',
        (thrown: unknown) =>
          thrown instanceof ConvexError ? String(thrown.data) : 'thrown as something a phone never sees'
      )

    expect(refusal).toContain('last four figures')
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
