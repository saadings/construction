import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** Reachable from a phone, so a missing access check is reachable from a phone too. */
const CLIENT_FACING = ['query', 'mutation', 'authenticatedQuery', 'authenticatedMutation']

/** These do the check themselves, which is the whole reason they exist. */
const SITE_SCOPED = ['siteQuery', 'siteMutation']

export type DeclaredFunction = {
  file: string
  name: string
  wrapper: string
  declaresSiteId: boolean
  args: string
  body: string
}

/** Takes a root so a probe can be walked somewhere nothing else is looking, rather than written into the tree everything reads. */
function convexFiles(root: string = join(repoRoot, 'convex')): Array<string> {
  const walk = (dir: string): Array<string> =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === '_generated' ? [] : walk(path)
      return path.endsWith('.ts') ? [path] : []
    })

  return walk(root)
}

/** Counts braces rather than stopping at the first one, so a nested object does not truncate the body before its args are visible. */
function bodyFrom(source: string, openingBrace: number): string {
  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(openingBrace, index + 1)
  }
  return source.slice(openingBrace)
}

/** The declared arguments only. `ctx.siteId` in a handler is what a checked function reads, so the body is the wrong place to look. */
function argsIn(body: string): string {
  const inline = /\bargs:\s*\{/.exec(body)
  if (inline) return bodyFrom(body, inline.index + inline[0].length - 1)

  // `args: typedIn` names a list declared elsewhere. Unreadable from here, and unreadable must not read as harmless.
  const named = /\bargs:\s*(\w+)/.exec(body)
  return named ? `declared elsewhere as ${named[1]}` : ''
}

export function declaredFunctionsIn(file: string, source: string): Array<DeclaredFunction> {
  const found: Array<DeclaredFunction> = []

  for (const match of source.matchAll(/export const (\w+) = (\w+)\(\{/g)) {
    const body = bodyFrom(source, match.index + match[0].length - 1)
    const args = argsIn(body)
    found.push({ file, name: match[1], wrapper: match[2], declaresSiteId: /\bsiteId\s*:/.test(args), args, body })
  }

  return found
}

/** A function a phone can call that names a site and never asks whether the caller may open it. */
export function skippingTheCheck(declared: Array<DeclaredFunction>): Array<DeclaredFunction> {
  return declared.filter((fn) => fn.declaresSiteId && CLIENT_FACING.includes(fn.wrapper))
}

const WRITES = ['mutation', 'authenticatedMutation', 'siteMutation']

/** Convex constrains an id or a literal by shape; it cannot say a name is not blank, so those values need parsing. */
const A_VALUE_CONVEX_CANNOT_CONSTRAIN = /v\.(string|number)\s*\(/

/** `args: typedIn` and `{ personId, ...typedIn }` both hide their list, and unreadable must not read as harmless. */
const A_LIST_DECLARED_ELSEWHERE = /declared elsewhere as|\.\.\.\w+/

const UNCONSTRAINED = new RegExp(`${A_VALUE_CONVEX_CANNOT_CONSTRAIN.source}|${A_LIST_DECLARED_ELSEWHERE.source}`)

/** A write that takes a value Convex cannot constrain and stores it without Zod ever seeing it. */
export function storingWhatWasNeverParsed(declared: Array<DeclaredFunction>): Array<DeclaredFunction> {
  return declared.filter(
    (fn) => WRITES.includes(fn.wrapper) && UNCONSTRAINED.test(fn.args) && !/\bchecked\s*\(/.test(fn.body)
  )
}

const THE_BYPASS = `
import { v } from 'convex/values'

import { authenticatedQuery } from '../utils/auth'

export const bypass = authenticatedQuery({
  args: { siteId: v.id('sites') },
  handler: async (ctx, args) => {
    return await ctx.db.get('sites', args.siteId)
  },
})
`

const THE_UNPARSED_WRITE = `
export const rename = siteMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch('sites', ctx.siteId, { name: args.name })
  },
})
`

const A_PARSED_WRITE = `
export const edit = siteMutation({
  args: typedIn,
  handler: async (ctx, args) => {
    const details = checked(siteInput, args)

    await ctx.db.patch('sites', ctx.siteId, details)
  },
})
`

const A_WRITE_TAKING_ONLY_AN_ID = `
export const hide = authenticatedMutation({
  args: { personId: v.id('people') },
  handler: async (ctx, { personId }) => {
    await ctx.db.patch('people', personId, { hidden: true })
  },
})
`

const A_WRITE_SPREADING_A_LIST = `
export const edit = authenticatedMutation({
  args: { personId: v.id('people'), ...typedIn },
  handler: async (ctx, args) => {
    await ctx.db.patch('people', args.personId, { name: args.name })
  },
})
`

describe('deciding who may open a site', () => {
  const declared = convexFiles().flatMap((file) =>
    declaredFunctionsIn(file.slice(repoRoot.length + 1), readFileSync(file, 'utf8'))
  )

  it('is never left to the function that happens to name a site', () => {
    const skipping = skippingTheCheck(declared).map((fn) => `${fn.file} exports ${fn.name} as ${fn.wrapper}`)

    expect(skipping).toEqual([])
  })

  it('is asked of every function this repository actually has', () => {
    // The floor. A matcher that stopped matching would report no violations, which is what a clean tree reports.
    expect(declared.length).toBeGreaterThanOrEqual(11)
    expect(declared.map((fn) => fn.wrapper)).toContain('siteQuery')
  })

  it('catches the bypass that passed typecheck, lint and every test', () => {
    // Verbatim the function written during review of the access check: it compiled, linted and passed 115 unit and 78 scenario tests.
    const caught = skippingTheCheck(declaredFunctionsIn('convex/sites/bypassProbe.ts', THE_BYPASS))

    expect(caught.map((fn) => fn.name)).toEqual(['bypass'])
  })

  it('catches it as a file on disk, not only as a string handed to the reader', () => {
    // Walked in a throwaway, never written into `convex/`: a probe there is inside tsconfig, and a concurrent whole-project typecheck fails when it disappears.
    const elsewhere = mkdtempSync(join(tmpdir(), 'construction-site-access-'))

    try {
      mkdirSync(join(elsewhere, 'sites'), { recursive: true })
      writeFileSync(join(elsewhere, 'sites', 'bypassProbe.ts'), THE_BYPASS)

      // The walker and the reader together, which is what runs in the gate. Either one failing alone reports a clean tree.
      const scanned = convexFiles(elsewhere).flatMap((file) => declaredFunctionsIn(file, readFileSync(file, 'utf8')))

      expect(skippingTheCheck(scanned).map((fn) => fn.name)).toEqual(['bypass'])
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  })

  it('leaves a function that does the check alone', () => {
    // The other half of the control: flagging everything would satisfy the test above while making the guard useless.
    const real = declared.filter((fn) => SITE_SCOPED.includes(fn.wrapper))

    expect(real.length).toBeGreaterThan(0)
    expect(skippingTheCheck(real)).toEqual([])
  })

  it('is not the only thing a wrapper leaves to discipline', () => {
    // Same shape as the bypass above, one surface along: `checked()` makes parsing easy without making unparsed impossible.
    const unparsed = storingWhatWasNeverParsed(
      declaredFunctionsIn('convex/sites/uncheckedProbe.ts', THE_UNPARSED_WRITE)
    )

    expect(unparsed.map((fn) => fn.name)).toEqual(['rename'])
  })

  it('leaves a write that parses what it was given alone', () => {
    // Verbatim from the sites mutations, which do call `checked`. Flagging these would make the rule useless.
    const parsed = declaredFunctionsIn('convex/sites/mutations.ts', A_PARSED_WRITE)

    expect(parsed.map((fn) => fn.name)).toEqual(['edit'])
    expect(storingWhatWasNeverParsed(parsed)).toEqual([])
  })

  it('will not take an argument list it cannot read as harmless', () => {
    // `args: typedIn` names a list declared elsewhere, so `sites.edit` and `sites.start` are unreadable from here.
    const unreadable = declaredFunctionsIn('convex/sites/mutations.ts', A_PARSED_WRITE.replace(/const details.*\n/, ''))

    expect(storingWhatWasNeverParsed(unreadable).map((fn) => fn.name)).toEqual(['edit'])
  })

  it('sees a list spread into otherwise readable arguments', () => {
    // Found by running this guard over the real mutations: `{ personId: v.id('people'), ...typedIn }` names no string and hides one.
    const spread = storingWhatWasNeverParsed(
      declaredFunctionsIn('convex/people/mutations.ts', A_WRITE_SPREADING_A_LIST)
    )

    expect(spread.map((fn) => fn.name)).toEqual(['edit'])
  })

  it('leaves a write whose arguments Convex can already constrain alone', () => {
    // `people.hide` takes an id and nothing else. Convex settles an id by shape, so there is nothing for Zod to say about it.
    const idOnly = declaredFunctionsIn('convex/people/mutations.ts', A_WRITE_TAKING_ONLY_AN_ID)

    expect(idOnly.map((fn) => fn.name)).toEqual(['hide'])
    expect(storingWhatWasNeverParsed(idOnly)).toEqual([])
  })

  it('reads a site out of the declared arguments, not out of a handler', () => {
    const inArgs = declaredFunctionsIn('probe.ts', 'export const a = query({ args: { siteId: v.id("sites") } })')
    const inHandler = declaredFunctionsIn('probe.ts', 'export const b = query({ handler: async (ctx) => ctx.siteId })')

    expect(inArgs[0].declaresSiteId).toBe(true)
    expect(inHandler[0].declaresSiteId).toBe(false)
  })
})
