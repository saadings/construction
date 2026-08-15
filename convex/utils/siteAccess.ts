import { ConvexError, type ObjectType, type PropertyValidators, type VId, v } from 'convex/values'

import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import {
  type AuthenticatedMutationCtx,
  type AuthenticatedQueryCtx,
  authenticatedMutation,
  authenticatedQuery,
} from './auth'

// One partnership, one set of books. Signing in is the whole of it: whoever is let in by the sign-in list sees every house, because that is what four people sharing one ledger actually do.

// `siteRoles` still says who is a partner, an investor or a client on which house. It is what the profit split is worked out from, and it decides nothing about who may look.

/** What a site-scoped handler is handed: the site it was asked about, already known to exist. */
export type SiteQueryCtx = AuthenticatedQueryCtx & { siteId: Id<'sites'> }
export type SiteMutationCtx = AuthenticatedMutationCtx & { siteId: Id<'sites'> }

// A house that is not there is still not there. This is what stops a mistyped id writing payments into nothing, which is the one thing the old rule was quietly also doing.
export async function aRealSite(ctx: QueryCtx, siteId: Id<'sites'>): Promise<boolean> {
  return (await ctx.db.get('sites', siteId)) !== null
}

// Declared here rather than asked of the caller, so a function written through these wrappers cannot be missing the site it is scoped to.

// It does not stop anyone declaring `siteId` on a bare `authenticatedQuery` and reaching around the check, which typechecks and lints today: a scan of the tree closes that, not a type.
type WithSiteId<ArgsValidator extends PropertyValidators> = ArgsValidator & { siteId: VId<Id<'sites'>> }

// Naming the site separately from the rest is what lets the wrappers read it: a mapped type over a type parameter has no properties yet.
type NamingASite<ArgsValidator extends PropertyValidators> = ObjectType<WithSiteId<ArgsValidator>> & {
  siteId: Id<'sites'>
}

function argsWithSiteId<ArgsValidator extends PropertyValidators>(args?: ArgsValidator): WithSiteId<ArgsValidator> {
  return { ...(args ?? ({} as ArgsValidator)), siteId: v.id('sites') }
}

// Nothing comes back for a house that is not there, which is what a screen asking after a hidden or mistyped id gets.
export function siteQuery<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: SiteQueryCtx, args: NamingASite<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedQuery<WithSiteId<ArgsValidator>, Output | null, NamingASite<ArgsValidator>>({
    args: argsWithSiteId(fn.args),
    handler: async (ctx, args) => {
      if (!(await aRealSite(ctx, args.siteId))) {
        return null
      }

      return await fn.handler({ ...ctx, siteId: args.siteId }, args)
    },
  })
}

// Refused out loud, since silence would read as saved, and as a `ConvexError` because production replaces a plain one's message with "Server Error" before the phone sees it.
export function siteMutation<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: SiteMutationCtx, args: NamingASite<ArgsValidator>) => Promise<Output>
}) {
  return authenticatedMutation<WithSiteId<ArgsValidator>, Output, NamingASite<ArgsValidator>>({
    args: argsWithSiteId(fn.args),
    handler: async (ctx, args) => {
      if (!(await aRealSite(ctx, args.siteId))) {
        throw new ConvexError('That house is not in the ledger.')
      }

      return await fn.handler({ ...ctx, siteId: args.siteId }, args)
    },
  })
}
