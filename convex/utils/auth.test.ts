// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { beforeEach, describe, expect, it } from 'vitest'

import schema from '../schema'
import { authenticatedMutation, authenticatedQuery } from './auth'

/**
 * The two wrappers every access-controlled function in this app will be built
 * on, exercised the way a real caller meets them: through registration, arg
 * validation, the identity check and into a handler that touches the database.
 *
 * They had no call sites and no tests, so nothing here failed. The cost of that
 * lands entirely on the first person to use them — the wrappers add `identity`
 * to the context and a type assertion then replaced the whole signature with
 * one that has never heard of it, so the documented example did not compile.
 *
 * What matters most is that a refusal happens *before* the handler body. A
 * wrapper that threw afterwards would produce the same error message while
 * having already read or written on behalf of someone who was never signed in,
 * so every rejection here is checked against a side effect that must not have
 * happened rather than against the message alone.
 */

/** Handler bodies push their name here, so "refused" can be told from "ran, then threw". */
const reached: Array<string> = []

const probe = {
  whoIsAsking: authenticatedQuery({
    handler: async (ctx) => {
      reached.push('whoIsAsking')
      return {
        subject: ctx.identity.subject,
        // Reading the database inside the handler is what proves the context
        // handed on still carries everything Convex put in it.
        people: (await ctx.db.query('users').collect()).length,
      }
    },
  }),

  remember: authenticatedMutation({
    args: { name: v.string() },
    handler: async (ctx, args) => {
      reached.push('remember')
      await ctx.db.insert('users', {
        externalId: ctx.identity.subject,
        name: args.name,
        primaryEmail: 'nauman@example.com',
        otherEmails: [],
      })
      return ctx.identity.subject
    },
  }),
}

/**
 * The probe functions are registered as a module rather than written to a file
 * under `convex/`. A file there is deployed and publicly callable, and a test
 * fixture is not something this app should be answering calls on in production.
 */
function convexWithProbe() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../utils/authProbe.ts': () => Promise.resolve(probe),
  })
}

const whoIsAsking = makeFunctionReference<'query', Record<string, never>, { subject: string; people: number }>(
  'utils/authProbe:whoIsAsking'
)
const remember = makeFunctionReference<'mutation', { name: string }, string>('utils/authProbe:remember')

/** The same function as a caller who has the wrong idea about it sees it. */
const rememberBadly = makeFunctionReference<'mutation', { name: number }, string>('utils/authProbe:remember')

beforeEach(() => {
  reached.length = 0
})

describe('a caller who is not signed in', () => {
  it('is refused by the query before the handler runs', async () => {
    const t = convexWithProbe()

    await expect(t.query(whoIsAsking, {})).rejects.toThrow('Not authenticated')
    expect(reached).toEqual([])
  })

  it('is refused by the mutation before anything is written', async () => {
    const t = convexWithProbe()

    await expect(t.mutation(remember, { name: 'Nauman' })).rejects.toThrow('Not authenticated')

    expect(reached).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })
})

describe('a caller who is signed in', () => {
  it('reaches the query handler with the identity attached', async () => {
    const t = convexWithProbe()

    const result = await t.withIdentity({ subject: 'user_x' }).query(whoIsAsking, {})

    expect(result).toEqual({ subject: 'user_x', people: 0 })
    expect(reached).toEqual(['whoIsAsking'])
  })

  it('reaches the mutation handler, which can still write', async () => {
    const t = convexWithProbe()

    const subject = await t.withIdentity({ subject: 'user_x' }).mutation(remember, { name: 'Nauman' })

    expect(subject).toBe('user_x')
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toMatchObject([
      { externalId: 'user_x', name: 'Nauman' },
    ])
  })

  it('sees the database the wrapper was given, not an empty one', async () => {
    // The context is passed on as a copy rather than by mutating what Convex
    // handed in, so this is where dropping something in the copy would show.
    const t = convexWithProbe()
    const signedIn = t.withIdentity({ subject: 'user_x' })

    await signedIn.mutation(remember, { name: 'Nauman' })

    expect(await signedIn.query(whoIsAsking, {})).toEqual({ subject: 'user_x', people: 1 })
  })
})

describe('the arguments a wrapped function declares', () => {
  it('are still validated', async () => {
    // The wrapper hands `args` through to the handler. If it stopped passing
    // the validators to Convex, every declared argument would silently become
    // optional and unchecked.
    const t = convexWithProbe()

    await expect(t.withIdentity({ subject: 'user_x' }).mutation(rememberBadly, { name: 7 })).rejects.toThrow()
    expect(reached).toEqual([])
  })

  it('may be omitted entirely', async () => {
    // The control: the validator rejects the call above for its type rather
    // than for having arguments at all, and a handler declaring none still runs.
    const t = convexWithProbe()

    await expect(t.withIdentity({ subject: 'user_x' }).query(whoIsAsking, {})).resolves.toBeDefined()
  })
})
