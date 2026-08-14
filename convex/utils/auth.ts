import {
  type DefaultFunctionArgs,
  type GenericMutationCtx,
  type GenericQueryCtx,
  type MutationBuilder,
  type QueryBuilder,
} from 'convex/server'
import type { PropertyValidators } from 'convex/values'

import type { DataModel } from '../_generated/dataModel'
import { mutation, query } from '../_generated/server'

/**
 * Like `query`, but ensures the caller is authenticated before running the handler.
 * Passes the verified `UserIdentity` as the second element of ctx.
 *
 * @example
 * ```ts
 * export const myQuery = authenticatedQuery({
 *   args: { orgId: v.string() },
 *   handler: async (ctx, args) => {
 *     // ctx.identity is guaranteed to be non-null here
 *     console.log(ctx.identity.subject)
 *     return await ctx.db.query('users').collect()
 *   },
 * })
 * ```
 */
export const authenticatedQuery = (<Args extends DefaultFunctionArgs>(fn: {
  args?: PropertyValidators
  handler: (
    ctx: GenericQueryCtx<DataModel> & {
      identity: NonNullable<Awaited<ReturnType<GenericQueryCtx<DataModel>['auth']['getUserIdentity']>>>
    },
    args: Args
  ) => Promise<unknown>
}) => {
  return query({
    args: fn.args ?? {},
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Not authenticated')
      }
      return await fn.handler(Object.assign(ctx, { identity }), args as Args)
    },
  })
}) as QueryBuilder<DataModel, 'public'>

/**
 * Like `mutation`, but ensures the caller is authenticated before running the handler.
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
export const authenticatedMutation = (<Args extends DefaultFunctionArgs>(fn: {
  args?: PropertyValidators
  handler: (
    ctx: GenericMutationCtx<DataModel> & {
      identity: NonNullable<Awaited<ReturnType<GenericMutationCtx<DataModel>['auth']['getUserIdentity']>>>
    },
    args: Args
  ) => Promise<unknown>
}) => {
  return mutation({
    args: fn.args ?? {},
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Not authenticated')
      }
      return await fn.handler(Object.assign(ctx, { identity }), args as Args)
    },
  })
}) as MutationBuilder<DataModel, 'public'>
