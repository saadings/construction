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

/** Signed in and nothing further asked: these reach every row of whatever table they open, for anyone with an account. */
const GLOBAL = ['query', 'mutation', 'authenticatedQuery', 'authenticatedMutation']

/** Global on purpose, each for a reason someone can disagree with. */
const DELIBERATELY_GLOBAL: Record<string, string> = {
  'accounts/mutations.ts rememberThisSignIn':
    'writes the row that makes the ledger know this sign-in, taken from ctx.identity.subject and nothing a caller could pass; every other write refuses a sign-in the ledger does not know, so this cannot be one of them',
}

/** Global by nobody's decision. This list may shrink and must never grow: what each one hands a signed-in non-partner is written beside it. */

// Empty, and that is the whole point of it. Every function asking nothing beyond being signed in is now global because somebody decided so, with the reason written above.
const NOT_YET_AUDITED: Record<string, string> = {}

/** How many are unaudited today. Lower it when one is fixed; a higher one is the defect this exists to stop. */
const STILL_UNAUDITED = 0

function named(fn: DeclaredFunction): string {
  return `${fn.file.replace(/^convex\//, '')} ${fn.name}`
}

/** A function that asks nothing beyond being signed in and has not been written down as either. */
export function globalAndUnaccountedFor(declared: Array<DeclaredFunction>): Array<string> {
  return declared
    .filter((fn) => GLOBAL.includes(fn.wrapper))
    .map(named)
    .filter((key) => DELIBERATELY_GLOBAL[key] === undefined && NOT_YET_AUDITED[key] === undefined)
}

// `internalMutation` is not reachable from a phone, which is why it was left out. This one is fed by the Clerk webhook: a boundary to a system we do not control, wearing a name that says the opposite.
const WRITES = ['mutation', 'authenticatedMutation', 'siteMutation', 'internalMutation']

/** Unparsed on purpose, each for a reason about what the code does rather than about the wrapper it was written with. */
const UNPARSED_ON_PURPOSE: Record<string, string> = {
  'accounts/actions.ts remove':
    'looks an account up by the id it was handed and deletes it, writing none of that string anywhere',
  'accounts/actions.ts upsert':
    "mirrors Clerk's own record of a sign-in, from a payload Svix has proved came from Clerk, and nothing in it leaves the mirror: no person is made, and personId is never written from it",
}

/** Convex constrains an id or a literal by shape; it cannot say a name is not blank, so those values need parsing. */
const A_VALUE_CONVEX_CANNOT_CONSTRAIN = /v\.(string|number|any)\s*\(/

/** `args: typedIn` and `{ personId, ...typedIn }` both hide their list, and unreadable must not read as harmless. */
const A_LIST_DECLARED_ELSEWHERE = /declared elsewhere as|\.\.\.\w+/

const UNCONSTRAINED = new RegExp(`${A_VALUE_CONVEX_CANNOT_CONSTRAIN.source}|${A_LIST_DECLARED_ELSEWHERE.source}`)

/** Written down as unparsed rather than left invisible. This list may shrink and must never grow. */
const NOT_YET_PARSED: Record<string, string> = {}

/** How many are unparsed today. Lower it when one is fixed; a higher one is the defect this exists to stop. */
const STILL_UNPARSED = 0

/** Zod having seen the value, however it was reached for. `checked` is the usual way and not the only one. */
const PARSED = /\bchecked\s*\(|\.safeParse\s*\(|\.parse\s*\(/

/** A write that takes a value Convex cannot constrain and stores it without Zod ever seeing it. */
export function storingWhatWasNeverParsed(declared: Array<DeclaredFunction>): Array<DeclaredFunction> {
  return declared.filter(
    (fn) =>
      WRITES.includes(fn.wrapper) &&
      UNCONSTRAINED.test(fn.args) &&
      !PARSED.test(fn.body) &&
      UNPARSED_ON_PURPOSE[named(fn)] === undefined
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

      // The same file read by the other guard: it names no site as far as that one is concerned, and nobody has written down why it may be global.
      expect(globalAndUnaccountedFor(scanned).map((key) => key.split(' ')[1])).toEqual(['bypass'])
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

  it('is asked of every write this repository has, and not only of probes', () => {
    // Six tests held this rule to hand-written strings and none of them ever pointed it at `convex/`. A rule that has not looked has not found nothing.
    const unparsed = storingWhatWasNeverParsed(declared)
      .map(named)
      .filter((key) => NOT_YET_PARSED[key] === undefined)

    expect(unparsed).toEqual([])
  })

  it('holds a write excused on purpose to the reason it was excused for', () => {
    // An excuse silences the rule for good, so what it claims has to be checkable. `upsert` is excused because nothing in the payload reaches the ledger; if it ever writes a person or a link again, the excuse is a lie and this says so.
    const upsert = readFileSync(join(repoRoot, 'convex', 'accounts', 'actions.ts'), 'utf8')

    expect(UNPARSED_ON_PURPOSE['accounts/actions.ts upsert']).toContain('no person is made')
    expect(upsert, 'upsert is excused for writing no person and now writes one').not.toContain("insert('people'")
    expect(upsert, 'upsert is excused for writing no link and now writes one').not.toContain('personId:')
  })

  it('has this many writes nobody has parsed yet, and the number only goes down', () => {
    expect(Object.keys(NOT_YET_PARSED).length).toBeLessThanOrEqual(STILL_UNPARSED)
  })

  it('is still flagging every write written down as unparsed, or the note has outlived the fault', () => {
    // The same shape as the global floor: a justification for something no longer true fails by name, and that is a line to delete.
    const flagged = storingWhatWasNeverParsed(declared).map(named)

    for (const key of Object.keys(NOT_YET_PARSED)) {
      expect(flagged, `${key} is written down as unparsed and no longer is`).toContain(key)
    }
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

  // The rule above is that a function naming a site must check it. It reports a clean tree over a function that names no site at all, and always would have.
  it('is asked of a function that names no site either, since that is the one nobody looks at', () => {
    expect(globalAndUnaccountedFor(declared)).toEqual([])
  })

  it('catches a new one, so the two lists are doing the work rather than the matcher', () => {
    const fresh = declaredFunctionsIn(
      'convex/people/queries.ts',
      'export const everyPhoneNumber = authenticatedQuery({ handler: async (ctx) => ctx.db.query("people").collect() })'
    )

    expect(globalAndUnaccountedFor(fresh)).toEqual(['people/queries.ts everyPhoneNumber'])
  })

  it('leaves a site-scoped function out of it, since that one has already been asked', () => {
    // The other half of the control: counting every function as global would satisfy the check above while saying nothing.
    const scoped = declared.filter((fn) => SITE_SCOPED.includes(fn.wrapper))

    expect(scoped.length).toBeGreaterThan(0)
    expect(globalAndUnaccountedFor(scoped)).toEqual([])
  })

  it('is looking at every global function this repository has, not at none of them', () => {
    // The floor, and the one this guard most needed: if the wrapper names stopped matching it would find nothing, which is what a clean tree looks like.
    const global = declared.filter((fn) => GLOBAL.includes(fn.wrapper)).map(named)

    // Anchored on the ones global by design, never on the ones waiting to be fixed: a floor standing on an exposure fails the day the exposure is removed, which is a guard fighting its own fix.
    for (const key of Object.keys(DELIBERATELY_GLOBAL)) {
      expect(global, `${key} is written down as global by design and is not in the tree`).toContain(key)
    }

    expect(Object.keys(DELIBERATELY_GLOBAL).length).toBeGreaterThanOrEqual(1)

    // Every one of them accounted for in one list or the other, and none in both.
    for (const key of global) {
      expect(
        (DELIBERATELY_GLOBAL[key] === undefined ? 0 : 1) + (NOT_YET_AUDITED[key] === undefined ? 0 : 1),
        `${key} is in neither list, or in both`
      ).toBe(1)
    }
  })

  it('holds each function excused as global to the thing its reason claims', () => {
    // An excuse silences the rule for good. What each one claims is read out of the file it excuses, so a reason that stops being true fails here rather than going quiet.
    const claims: Record<string, { file: Array<string>; says?: string; neverSays?: Array<string> }> = {
      'accounts/mutations.ts rememberThisSignIn': {
        file: ['convex', 'accounts', 'mutations.ts'],
        says: 'ctx.identity.subject',
      },
    }

    // Every excuse is checked, so adding one without a way to check it fails rather than passing quietly.
    expect(Object.keys(claims).sort()).toEqual(Object.keys(DELIBERATELY_GLOBAL).sort())

    for (const [key, claim] of Object.entries(claims)) {
      const source = readFileSync(join(repoRoot, ...claim.file), 'utf8')

      if (claim.says !== undefined) {
        expect(source, `${key} is excused for ${claim.says} and no longer does it`).toContain(claim.says)
      }

      for (const never of claim.neverSays ?? []) {
        expect(source, `${key} is excused for reading no ${never} and now reads one`).not.toContain(never)
      }
    }
  })

  it('has this many nobody has decided about, and the number only goes down', () => {
    // A new global function can be waved through by adding it to the unaudited list. This is what stops that.
    expect(Object.keys(NOT_YET_AUDITED).length).toBeLessThanOrEqual(STILL_UNAUDITED)

    // And each is written down as what it hands a signed-in non-partner, not merely named.
    for (const [key, exposes] of Object.entries(NOT_YET_AUDITED)) {
      expect(exposes.length, `${key} says nothing about what it exposes`).toBeGreaterThan(10)
    }
  })

  it('reads a site out of the declared arguments, not out of a handler', () => {
    const inArgs = declaredFunctionsIn('probe.ts', 'export const a = query({ args: { siteId: v.id("sites") } })')
    const inHandler = declaredFunctionsIn('probe.ts', 'export const b = query({ handler: async (ctx) => ctx.siteId })')

    expect(inArgs[0].declaresSiteId).toBe(true)
    expect(inHandler[0].declaresSiteId).toBe(false)
  })
})
