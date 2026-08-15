import type { UserIdentity } from 'convex/server'
import { ConvexError, type ObjectType, type PropertyValidators } from 'convex/values'

import type { QueryCtx } from '../_generated/server'
import {
  type AuthenticatedMutationCtx,
  type AuthenticatedQueryCtx,
  authenticatedMutation,
  authenticatedQuery,
} from './auth'

// The tables behind this are global on purpose. A person's account spans every site, because a steel supplier delivering to two houses has one balance and not two halves somebody adds up.

// So the question is only whether this sign-in is one the ledger knows. Who may sign in at all is decided by the sign-in list, before anybody reaches this.
export async function knownSignIn(ctx: QueryCtx, identity: UserIdentity): Promise<boolean> {
  const account = await ctx.db
    .query('accounts')
    .withIndex('byExternalId', (q) => q.eq('externalId', identity.subject))
    .unique()

  return account !== null
}

export type LedgerQueryCtx = AuthenticatedQueryCtx
export type LedgerMutationCtx = AuthenticatedMutationCtx

// Nothing comes back until the sign-in has landed here, which is the moment between signing in and the account arriving rather than a state anyone stays in.
export function ledgerQuery<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: LedgerQueryCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedQuery<ArgsValidator, Output | null>({
    args: fn.args,
    handler: async (ctx, args) => {
      if (!(await knownSignIn(ctx, ctx.identity))) {
        return null
      }

      return await fn.handler(ctx, args)
    },
  })
}

// Refused out loud, because a write that quietly does nothing reads as saved.
export function ledgerMutation<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: LedgerMutationCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedMutation<ArgsValidator, Output>({
    args: fn.args,
    handler: async (ctx, args) => {
      if (!(await knownSignIn(ctx, ctx.identity))) {
        throw new ConvexError('Your sign-in has not come through yet. Try again in a moment.')
      }

      return await fn.handler(ctx, args)
    },
  })
}
