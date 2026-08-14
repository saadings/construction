import { type GenericMutationCtx, type GenericQueryCtx, type UserIdentity } from 'convex/server'
import type { ObjectType, PropertyValidators } from 'convex/values'

import type { DataModel } from '../_generated/dataModel'
import { mutation, query } from '../_generated/server'

/**
 * What the wrappers below hand their handler: everything Convex provides, plus
 * the identity of the person who was checked on the way in.
 *
 * Written out as types rather than asserted onto the builder. A type assertion
 * replaces the expression's type outright, so asserting these functions to be
 * `QueryBuilder`/`MutationBuilder` erased the one thing they add — those
 * builders declare a plain `GenericQueryCtx`, which has no `identity` — and the
 * example in this file's own documentation did not compile against it.
 */
export type AuthenticatedQueryCtx = GenericQueryCtx<DataModel> & { identity: UserIdentity }
export type AuthenticatedMutationCtx = GenericMutationCtx<DataModel> & { identity: UserIdentity }

/**
 * Like `query`, but refuses the call unless the caller is signed in. The
 * handler receives the verified identity on its context.
 *
 * @example
 * ```ts
 * export const myQuery = authenticatedQuery({
 *   args: { siteId: v.string() },
 *   handler: async (ctx, args) => {
 *     // ctx.identity is guaranteed to be non-null here
 *     console.log(ctx.identity.subject, args.siteId)
 *     return await ctx.db.query('users').collect()
 *   },
 * })
 * ```
 */
export function authenticatedQuery<ArgsValidator extends PropertyValidators, Output>(fn: {
  args?: ArgsValidator
  handler: (ctx: AuthenticatedQueryCtx, args: ObjectType<ArgsValidator>) => Promise<Output>
}) {
  // The type arguments are given rather than inferred. Convex works out how
  // many arguments a handler takes with a conditional type over the validators,
  // and a conditional cannot resolve while the validators are still a type
  // parameter — so inference settles on "either zero or one", which no concrete
  // handler matches. Naming them keeps the registered function's argument types
  // derived from the validators for whoever calls it.
  return query<ArgsValidator, void, Promise<Output>, [ObjectType<ArgsValidator>]>({
    // Declaring no arguments is declaring an empty set of validators, and an
    // empty object is one whatever `ArgsValidator` turns out to be.
    args: fn.args ?? ({} as ArgsValidator),
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Not authenticated')
      }
      // Spread rather than `Object.assign(ctx, …)`: the context belongs to
      // Convex, and adding a field to it reaches back into the caller's object.
      return await fn.handler({ ...ctx, identity }, args)
    },
  })
}

/**
 * Like `mutation`, but refuses the call unless the caller is signed in. The
 * handler receives the verified identity on its context.
 *
 * @example
 * ```ts
 * export const myMutation = authenticatedMutation({
 *   args: { name: v.string() },
 *   handler: async (ctx, args) => {
 *     console.log(ctx.identity.subject)
 *     await ctx.db.insert('users', { name: args.name })
 *   },
 * })
 * ```
 */
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
