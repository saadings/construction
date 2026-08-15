import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Three screens each needed to name somebody, so three mutations write to `people`: the people screen, the day sheet, and money coming in. The people screen refused a duplicate for a day while the other two inserted regardless -- and two rows for one man split his money across both, so his balance, what he is owed and what he put in are all wrong, quietly.

// The lesson, in one line: closing one entrance to a table is not closing the table. A rule enforced at a mutation is enforced at that mutation, so this asks the question of the table instead.
const repoRoot = process.cwd()

const HOW_A_PERSON_IS_FOUND = 'personAlreadyCalled'

function everyFileUnder(from: string, matching: RegExp): Array<string> {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)

    return entry.isDirectory() ? everyFileUnder(path, matching) : matching.test(entry.name) ? [path] : []
  })
}

/** Where a handler begins, which is the boundary a lookback has to stop at: a check in the mutation above is not a check on this one. */
function whatHandlesTheInsertAt(source: string, at: number): string {
  const opened = [...source.slice(0, at).matchAll(/handler: async/g)]

  return opened.length === 0 ? source.slice(0, at) : source.slice(opened[opened.length - 1].index, at)
}

/** Every insert into `people` that did not first ask whether that person is already there. */
export function insertsAPersonUnasked(source: string): Array<string> {
  const found: Array<string> = []

  for (const insert of source.matchAll(/ctx\.db\.insert\(\s*'people'/g)) {
    const handler = whatHandlesTheInsertAt(source, insert.index)

    if (!handler.includes(HOW_A_PERSON_IS_FOUND)) {
      // Said with the words around it, so a reader can see which insert it is without opening the file.
      found.push(handler.slice(-140).replace(/\s+/g, ' ').trim())
    }
  }

  return found
}

describe('every way a person gets written down', () => {
  const backend = everyFileUnder(join(repoRoot, 'convex'), /\.ts$/)
    .filter((path) => !path.includes('/_generated/') && !path.endsWith('.test.ts'))
    .map((path) => ({ path: path.split('/convex/')[1], source: readFileSync(path, 'utf8') }))

  it('asks whether that person is already there', () => {
    const unasked = backend.flatMap(({ path, source }) =>
      insertsAPersonUnasked(source).map((where) => `${path}: ${where}`)
    )

    expect(unasked).toEqual([])
  })

  it('is asked of every door there is, rather than of none of them', () => {
    // The floor, counted the way the sweep counts. Three files write a person today; a reader that stopped finding inserts would report the same clean tree as one where every door is closed.
    const doors = backend.filter(({ source }) => /ctx\.db\.insert\(\s*'people'/.test(source)).map(({ path }) => path)

    expect(doors).toContain('people/mutations.ts')
    expect(doors).toContain('payments/mutations.ts')
    expect(doors).toContain('moneyIn/mutations.ts')
  })

  it('would notice a fourth door opened without it', () => {
    // Verbatim in the shape all three had before they were closed.
    const straightIn = `handler: async (ctx, args) => {
      const fromId = await ctx.db.insert('people', { name: args.newPerson, hidden: false })
    }`

    expect(insertsAPersonUnasked(straightIn)).toHaveLength(1)
  })

  it('leaves alone a door that asks first', () => {
    const asksFirst = `handler: async (ctx, args) => {
      const already = await personAlreadyCalled(ctx, args.newPerson)
      const fromId = already?._id ?? (await ctx.db.insert('people', { name: args.newPerson, hidden: false }))
    }`

    expect(insertsAPersonUnasked(asksFirst)).toEqual([])
  })

  it('does not take a check in the mutation above as a check on this one', () => {
    // The reason the lookback stops at the handler. Two mutations in one file, and only the first asks.
    const oneAsksOneDoesNot = `handler: async (ctx, args) => {
      const already = await personAlreadyCalled(ctx, args.name)
    },
    })

    export const other = ledgerMutation({
    handler: async (ctx, args) => {
      await ctx.db.insert('people', { name: args.name, hidden: false })
    }`

    expect(insertsAPersonUnasked(oneAsksOneDoesNot)).toHaveLength(1)
  })
})
