import type { UserIdentity } from 'convex/server'
import { ConvexError, type ObjectType, type PropertyValidators, type VId, v } from 'convex/values'

import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import {
  type AuthenticatedMutationCtx,
  type AuthenticatedQueryCtx,
  authenticatedMutation,
  authenticatedQuery,
} from './auth'

// The whole access model lives here. Clerk proves who is asking; this decides what they may reach.

/** What a site-scoped handler is handed: the site it was asked about, and the person asking, both already checked. */
export type SiteQueryCtx = AuthenticatedQueryCtx & { siteId: Id<'sites'>; personId: Id<'people'> }
export type SiteMutationCtx = AuthenticatedMutationCtx & { siteId: Id<'sites'>; personId: Id<'people'> }

/** Which person is signed in, or null when this sign-in has not been attached to anyone yet. */
export async function personSignedInAs(ctx: QueryCtx, identity: UserIdentity): Promise<Id<'people'> | null> {
  const account = await ctx.db
    .query('accounts')
    .withIndex('byExternalId', (q) => q.eq('externalId', identity.subject))
    .unique()

  return account?.personId ?? null
}

// Signing in is not reach. A person reaches a site only by being a partner on that site.
export async function siteReachableBy(
  ctx: QueryCtx,
  identity: UserIdentity,
  siteId: Id<'sites'>
): Promise<Id<'people'> | null> {
  const personId = await personSignedInAs(ctx, identity)
  if (personId === null) {
    return null
  }

  const roles = await ctx.db
    .query('siteRoles')
    .withIndex('bySiteAndPerson', (q) => q.eq('siteId', siteId).eq('personId', personId))
    .collect()

  // Clients and investors hold a role on a site so the money reads correctly; neither of them may open it.
  return roles.some((role) => role.capacity === 'partner') ? personId : null
}

// Declared here rather than asked of the caller, so no site-scoped function can be written without the site it is scoped to.
type WithSiteId<ArgsValidator extends PropertyValidators> = ArgsValidator & { siteId: VId<Id<'sites'>> }

// Naming the site separately from the rest is what lets the wrappers read it: a mapped type over a type parameter has no properties yet.
type NamingASite<ArgsValidator extends PropertyValidators> = ObjectType<WithSiteId<ArgsValidator>> & {
  siteId: Id<'sites'>
}

function argsWithSiteId<ArgsValidator extends PropertyValidators>(args?: ArgsValidator): WithSiteId<ArgsValidator> {
  return { ...(args ?? ({} as ArgsValidator)), siteId: v.id('sites') }
}

// Reading a site you are not on returns nothing rather than refusing, so the answer is the same whether the site is not yours or not there.
export function siteQuery<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: SiteQueryCtx, args: NamingASite<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedQuery<WithSiteId<ArgsValidator>, Output | null, NamingASite<ArgsValidator>>({
    args: argsWithSiteId(fn.args),
    handler: async (ctx, args) => {
      const personId = await siteReachableBy(ctx, ctx.identity, args.siteId)
      if (personId === null) {
        return null
      }

      return await fn.handler({ ...ctx, siteId: args.siteId, personId }, args)
    },
  })
}

// Writing is refused out loud, since silence would read as saved, and as a `ConvexError` because production replaces a plain one's message with "Server Error" before the phone sees it.
export function siteMutation<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: SiteMutationCtx, args: NamingASite<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedMutation<WithSiteId<ArgsValidator>, Output, NamingASite<ArgsValidator>>({
    args: argsWithSiteId(fn.args),
    handler: async (ctx, args) => {
      const personId = await siteReachableBy(ctx, ctx.identity, args.siteId)
      if (personId === null) {
        throw new ConvexError('This site is not one of yours.')
      }

      return await fn.handler({ ...ctx, siteId: args.siteId, personId }, args)
    },
  })
}
