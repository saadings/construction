// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from '../_generated/api'
import schema from '../schema'

function convexWithAccounts() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../accounts/mutations.ts': () => import('./mutations'),
  })
}

const SIGNED_IN_AS = 'user_older_than_this_table'
const asHim = { subject: SIGNED_IN_AS, name: 'The partner', email: 'partner@example.com' }

describe('a sign-in the ledger has never seen', () => {
  it('is written in from the identity making the call, and reaches the ledger straight after', async () => {
    // This is the case that stranded a real person: his Clerk account predates the accounts table, and the webhook that fills it only ever fires for a new Clerk user.
    const t = convexWithAccounts()
    const him = t.withIdentity(asHim)

    // Refused before, because the ledger does not know him.
    expect(await him.query(api.sites.queries.all, {})).toBeNull()

    await him.mutation(api.accounts.mutations.rememberThisSignIn, {})

    // And known after, which is the whole of it.
    expect(await him.query(api.sites.queries.all, {})).toEqual([])
  })

  it('takes what it stores from the caller, not from anything the caller passes', async () => {
    const t = convexWithAccounts()
    await t.withIdentity(asHim).mutation(api.accounts.mutations.rememberThisSignIn, {})

    const [account] = await t.run((ctx) => ctx.db.query('accounts').collect())

    expect(account?.externalId).toBe(SIGNED_IN_AS)
    expect(account?.name).toBe('The partner')
    expect(account?.primaryEmail).toBe('partner@example.com')
  })

  it('is written once however many times it is called', async () => {
    // The client calls it on every sign-in, so a second call must find the first rather than make a second row -- which `personSignedInAs` would then refuse to read at all.
    const t = convexWithAccounts()
    const him = t.withIdentity(asHim)

    const first = await him.mutation(api.accounts.mutations.rememberThisSignIn, {})
    const again = await him.mutation(api.accounts.mutations.rememberThisSignIn, {})

    expect(again).toBe(first)
    expect(await t.run((ctx) => ctx.db.query('accounts').collect())).toHaveLength(1)
  })

  it('leaves alone an account the webhook already made, rather than overwriting what it knows', async () => {
    const t = convexWithAccounts()
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        externalId: SIGNED_IN_AS,
        name: 'The partner',
        primaryEmail: 'partner@example.com',
        otherEmails: ['partner@work.example.com'],
        imageUrl: 'https://img.example.com/partner.png',
      })
    })

    await t.withIdentity(asHim).mutation(api.accounts.mutations.rememberThisSignIn, {})

    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect())
    // What the webhook knows and this mutation does not: a signing-in that overwrote the row would leave a partner with a blank name and no address on a screen that shows them.
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({
      name: 'The partner',
      primaryEmail: 'partner@example.com',
      otherEmails: ['partner@work.example.com'],
      imageUrl: 'https://img.example.com/partner.png',
    })
  })

  it('is refused to somebody not signed in at all', async () => {
    const t = convexWithAccounts()

    await expect(t.mutation(api.accounts.mutations.rememberThisSignIn, {})).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('accounts').collect())).toEqual([])
  })
})
