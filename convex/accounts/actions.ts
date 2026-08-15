import type { UserJSON } from '@clerk/backend'
import { type Validator, v } from 'convex/values'

import { type QueryCtx, internalMutation, query } from '../_generated/server'

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await currentAccount(ctx)
  },
})

export const upsert = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  async handler(ctx, { data }) {
    const primaryEmailObj = data.email_addresses.find((e) => e.id === data.primary_email_address_id)
    const primaryEmail = primaryEmailObj?.email_address ?? ''
    const otherEmails = data.email_addresses
      .filter((e) => e.id !== data.primary_email_address_id)
      .map((e) => e.email_address)

    const accountAttributes = {
      externalId: data.id,
      name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
      primaryEmail,
      otherEmails,
      imageUrl: data.image_url ?? undefined,
    }

    const account = await accountByExternalId(ctx, data.id)
    if (account !== null) {
      // Patched field by field, never replaced: `personId` belongs to the app and Clerk knows nothing about it.
      await ctx.db.patch('accounts', account._id, accountAttributes)
      return
    }

    // The cold start: the very first sign-in on a deployment is the person setting it up, so it declares itself, there being nobody to ask.

    // That holds only while the first sign-up really is that person. On a fresh production deployment with sign-up open, it is whoever finds the URL first.

    // So the Clerk allowlist is not a hardening of this design, it is a precondition of it: restrictions.allowlist true, and every partner's address added, before production takes a sign-up.

    // Everyone after arrives unlinked and waits to be joined to a person already in the ledger, because guessing which one would put one partner's money under another's name.
    const personId = (await anyoneLinkedYet(ctx))
      ? undefined
      : await ctx.db.insert('people', {
          name: accountAttributes.name === '' ? accountAttributes.primaryEmail : accountAttributes.name,
          hidden: false,
        })

    await ctx.db.insert('accounts', { ...accountAttributes, personId })
  },
})

export const remove = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const account = await accountByExternalId(ctx, clerkUserId)
    if (account !== null) {
      // The account goes; the person stays, because payments point at them forever.
      await ctx.db.delete('accounts', account._id)
    } else {
      console.warn(`Can't delete account, there is none for Clerk user ID: ${clerkUserId}`)
    }
  },
})

export async function currentAccountOrThrow(ctx: QueryCtx) {
  const account = await currentAccount(ctx)
  if (!account) throw new Error("Can't get current account")
  return account
}

export async function currentAccount(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) {
    return null
  }
  return await accountByExternalId(ctx, identity.subject)
}

// Asked of the deployment rather than of this webhook, so a half-set-up one can still be rescued without anybody editing the database by hand.
async function anyoneLinkedYet(ctx: QueryCtx): Promise<boolean> {
  const accounts = await ctx.db.query('accounts').collect()

  return accounts.some((account) => account.personId !== undefined)
}

async function accountByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query('accounts')
    .withIndex('byExternalId', (q) => q.eq('externalId', externalId))
    .unique()
}
