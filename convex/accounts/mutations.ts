import { authenticatedMutation } from '../utils/auth'

// The one write that cannot go through `ledgerMutation`, because it is what makes the ledger know this sign-in at all. Everything else refuses an unknown one; this is how a sign-in stops being unknown.

// It exists because the only other writer of `accounts` is the Clerk webhook, and `user.created` never fires again for somebody who already had a Clerk account. Anyone who signed up before this table did would otherwise wait forever.

// not-from-a-screen: the app itself, on the way in, so a sign-in is known before anything is asked of it
export const rememberThisSignIn = authenticatedMutation({
  handler: async (ctx) => {
    const already = await ctx.db
      .query('accounts')
      .withIndex('byExternalId', (q) => q.eq('externalId', ctx.identity.subject))
      .unique()

    if (already !== null) {
      return already._id
    }

    // Taken from the identity making the call and from nowhere else. There is no argument to pass, so there is nothing here a caller could claim to be.
    return await ctx.db.insert('accounts', {
      externalId: ctx.identity.subject,
      name: ctx.identity.name ?? ctx.identity.nickname ?? 'Whoever set this up',
      primaryEmail: ctx.identity.email ?? '',
      otherEmails: [],
      imageUrl: ctx.identity.pictureUrl ?? undefined,
    })
  },
})
