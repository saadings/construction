import type { UserIdentity } from 'convex/server'
import { ConvexError, type ObjectType, type PropertyValidators } from 'convex/values'

import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import {
  type AuthenticatedMutationCtx,
  type AuthenticatedQueryCtx,
  authenticatedMutation,
  authenticatedQuery,
} from './auth'
import { personSignedInAs } from './siteAccess'

// The tables behind this are global on purpose. A person's account spans every site, because a steel supplier delivering to two houses has one balance and not two halves somebody adds up.

// So the question is not which site, but whether this is a partner at all. Clients and investors hold roles for the money and sign in to nothing.
export async function partnerSomewhere(ctx: QueryCtx, identity: UserIdentity): Promise<Id<'people'> | null> {
  const personId = await personSignedInAs(ctx, identity)
  if (personId === null) {
    return null
  }

  const held = await ctx.db
    .query('siteRoles')
    .withIndex('byPerson', (q) => q.eq('personId', personId))
    .collect()

  return held.some((role) => role.capacity === 'partner') ? personId : null
}

export type PartnerQueryCtx = AuthenticatedQueryCtx & { personId: Id<'people'> }
export type PartnerMutationCtx = AuthenticatedMutationCtx & { personId: Id<'people'> }

// Signing in is not reach, here either. Nothing comes back to someone who is on no site, the same shape a site-scoped read refuses in.
export function partnerQuery<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: PartnerQueryCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedQuery<ArgsValidator, Output | null>({
    args: fn.args,
    handler: async (ctx, args) => {
      const personId = await partnerSomewhere(ctx, ctx.identity)
      if (personId === null) {
        return null
      }

      return await fn.handler({ ...ctx, personId }, args)
    },
  })
}

// Refused out loud, because a write that quietly does nothing reads as saved.
export function partnerMutation<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: PartnerMutationCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedMutation<ArgsValidator, Output>({
    args: fn.args,
    handler: async (ctx, args) => {
      const personId = await partnerSomewhere(ctx, ctx.identity)
      if (personId === null) {
        throw new ConvexError('Ask Nauman to put you on a site first.')
      }

      return await fn.handler({ ...ctx, personId }, args)
    },
  })
}
