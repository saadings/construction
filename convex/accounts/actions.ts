import type { UserJSON } from '@clerk/backend'
import { type Validator, v } from 'convex/values'

import { type QueryCtx, internalMutation } from '../_generated/server'

// not-from-a-screen: the Clerk webhook, mirroring their record of a sign-in; no screen writes it and none should
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

    // No person is made and none is asked for. A sign-in is somebody who may use the ledger; who they are in it -- a partner, an investor, a client -- is written down where the money needs it and nowhere else.
    await ctx.db.insert('accounts', accountAttributes)
  },
})

// not-from-a-screen: the Clerk webhook again, when a sign-in is deleted at their end
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

async function accountByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query('accounts')
    .withIndex('byExternalId', (q) => q.eq('externalId', externalId))
    .unique()
}
