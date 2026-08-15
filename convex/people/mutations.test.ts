// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { refusalFrom } from '../../shared/testing/refusals'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'

const SIGNED_IN_AS = 'user_nauman'

// Vite's glob leaves out the directory the test itself sits in, so this directory's own functions are named rather than swept up.
function convexWithPeople() {
  return convexTest(schema, {
    ...import.meta.glob('../**/*.*s'),
    '../people/mutations.ts': () => import('./mutations'),
    '../people/queries.ts': () => import('./queries'),
  })
}

// A partner on a site. People, trades and bank accounts are global, so what they ask is whether this is a partner at all rather than which site.
async function anAccount(ctx: MutationCtx) {
  const personId = await ctx.db.insert('people', { name: 'The partner', hidden: false })
  const siteId = await ctx.db.insert('sites', {
    name: '1-A, Phase 0',
    builtForAClient: false,
    stage: 'building',
    hidden: false,
  })
  await ctx.db.insert('siteRoles', { personId, siteId, capacity: 'partner' })

  await ctx.db.insert('accounts', {
    externalId: SIGNED_IN_AS,
    name: 'The partner',
    primaryEmail: 'partner@example.com',
    otherEmails: [],
    personId,
  })
}

describe('adding someone the business deals with', () => {
  it('stores the name and number the way they should be written', async () => {
    const t = convexWithPeople()
    await t.run(anAccount)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    const personId = await signedIn.mutation(api.people.mutations.add, {
      name: '  A   mason ',
      phone: '0300 0000000',
    })

    const person = await t.run((ctx) => ctx.db.get('people', personId))
    expect(person?.name).toBe('A mason')
    // Five different shapes of the same number appear across the workbooks; one shape comes out.
    expect(person?.phone).toBe('0300-0000000')
  })

  it('says what is wrong in words, and writes nothing', async () => {
    const t = convexWithPeople()
    await t.run(anAccount)

    const refusal = await refusalFrom(
      t.withIdentity({ subject: SIGNED_IN_AS }).mutation(api.people.mutations.add, { name: 'S' })
    )

    expect(refusal).toBe('Put in the name of the person or shop paid.')
    // Only the partner set up above is there. Nothing was written for the name that was refused.
    expect((await t.run((ctx) => ctx.db.query('people').collect())).map((person) => person.name)).toEqual([
      'The partner',
    ])
  })

  it('turns away a caller who is not signed in', async () => {
    const t = convexWithPeople()

    await expect(t.mutation(api.people.mutations.add, { name: 'A mason' })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('people').collect())).toEqual([])
  })
})

describe('the list of people', () => {
  it('reads in the order a person would look for them, and drops the hidden ones', async () => {
    const t = convexWithPeople()
    await t.run(anAccount)

    const signedIn = t.withIdentity({ subject: SIGNED_IN_AS })
    for (const name of ['A mason', 'A supplier', 'A client']) {
      await signedIn.mutation(api.people.mutations.add, { name })
    }

    const gone = await signedIn.mutation(api.people.mutations.add, { name: 'Someone Else' })
    await signedIn.mutation(api.people.mutations.hide, { personId: gone })

    expect((await signedIn.query(api.people.queries.list, {}))?.map((person) => person.name)).toEqual([
      'A client',
      'A mason',
      'A supplier',
      // The partner the fixture signs in as, who is a person like any other.
      'The partner',
    ])
    // Hidden, not deleted: payments point at them forever, and a name that vanishes turns settled money into a mystery.
    expect(await t.run((ctx) => ctx.db.get('people', gone))).toMatchObject({ hidden: true })
  })
})
