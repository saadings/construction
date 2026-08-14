import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** Reachable from a phone, so a missing access check is reachable from a phone too. */
const CLIENT_FACING = ['query', 'mutation', 'authenticatedQuery', 'authenticatedMutation']

/** These do the check themselves, which is the whole reason they exist. */
const SITE_SCOPED = ['siteQuery', 'siteMutation']

export type DeclaredFunction = { file: string; name: string; wrapper: string; declaresSiteId: boolean }

function convexFiles(): Array<string> {
  const walk = (dir: string): Array<string> =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === '_generated' ? [] : walk(path)
      return path.endsWith('.ts') ? [path] : []
    })

  return walk(join(repoRoot, 'convex'))
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

/** `siteId` inside the declared arguments, never `ctx.siteId` in a handler, which is what a checked function reads. */
function declaresSiteId(body: string): boolean {
  const args = /\bargs:\s*\{/.exec(body)
  if (!args) return false

  return /\bsiteId\s*:/.test(bodyFrom(body, args.index + args[0].length - 1))
}

export function declaredFunctionsIn(file: string, source: string): Array<DeclaredFunction> {
  const found: Array<DeclaredFunction> = []

  for (const match of source.matchAll(/export const (\w+) = (\w+)\(\{/g)) {
    const body = bodyFrom(source, match.index + match[0].length - 1)
    found.push({ file, name: match[1], wrapper: match[2], declaresSiteId: declaresSiteId(body) })
  }

  return found
}

/** A function a phone can call that names a site and never asks whether the caller may open it. */
export function skippingTheCheck(declared: Array<DeclaredFunction>): Array<DeclaredFunction> {
  return declared.filter((fn) => fn.declaresSiteId && CLIENT_FACING.includes(fn.wrapper))
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

  it('catches it as a file in the tree, not only as a string handed to the reader', () => {
    const probe = join(repoRoot, 'convex', 'sites', 'bypassProbe.ts')

    writeFileSync(probe, THE_BYPASS)
    try {
      // The walker and the reader together, which is what runs in the gate. Either one failing alone reports a clean tree.
      const scanned = convexFiles().flatMap((file) =>
        declaredFunctionsIn(file.slice(repoRoot.length + 1), readFileSync(file, 'utf8'))
      )

      expect(skippingTheCheck(scanned).map((fn) => fn.name)).toEqual(['bypass'])
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('leaves a function that does the check alone', () => {
    // The other half of the control: flagging everything would satisfy the test above while making the guard useless.
    const real = declared.filter((fn) => SITE_SCOPED.includes(fn.wrapper))

    expect(real.length).toBeGreaterThan(0)
    expect(skippingTheCheck(real)).toEqual([])
  })

  it('reads a site out of the declared arguments, not out of a handler', () => {
    const inArgs = declaredFunctionsIn('probe.ts', 'export const a = query({ args: { siteId: v.id("sites") } })')
    const inHandler = declaredFunctionsIn('probe.ts', 'export const b = query({ handler: async (ctx) => ctx.siteId })')

    expect(inArgs[0].declaresSiteId).toBe(true)
    expect(inHandler[0].declaresSiteId).toBe(false)
  })
})
