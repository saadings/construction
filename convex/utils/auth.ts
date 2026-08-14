import { type GenericMutationCtx, type GenericQueryCtx, type UserIdentity } from 'convex/server'
import type { ObjectType, PropertyValidators } from 'convex/values'

import type { DataModel } from '../_generated/dataModel'
import { mutation, query } from '../_generated/server'

// Written as types, never asserted onto the builder: an `as QueryBuilder` erases the `identity` these wrappers exist to add.
export type AuthenticatedQueryCtx = GenericQueryCtx<DataModel> & { identity: UserIdentity }
export type AuthenticatedMutationCtx = GenericMutationCtx<DataModel> & { identity: UserIdentity }

// Like `query`, but refuses the call unless the caller is signed in, handing the handler the verified identity.
export function authenticatedQuery<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: AuthenticatedQueryCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  // Type arguments given, not inferred: Convex counts handler arguments with a conditional that cannot resolve over a type parameter.
  return query<ArgsValidator, void, Promise<Output>, [ObjectType<ArgsValidator>]>({
    // Declaring no arguments is declaring an empty set of validators.
    args: fn.args ?? ({} as ArgsValidator),
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Not authenticated')
      }
      // Spread, not `Object.assign(ctx, …)`: the context is Convex's, and writing to it reaches back into the caller.
      return await fn.handler({ ...ctx, identity }, args)
    },
  })
}

// Like `mutation`, but refuses the call unless the caller is signed in, handing the handler the verified identity.
export function authenticatedMutation<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: AuthenticatedMutationCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  return mutation<ArgsValidator, void, Promise<Output>, [ObjectType<ArgsValidator>]>({
    args: fn.args ?? ({} as ArgsValidator),
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Not authenticated')
      }
      return await fn.handler({ ...ctx, identity }, args)
    },
  })
}
