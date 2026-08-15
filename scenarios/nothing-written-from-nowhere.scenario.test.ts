import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// A table with a mutation and no screen is a table nobody can put anything in. It passes every test it has, deploys, and does nothing -- which is what `moneyIn` did for a day: money coming in could be recorded by nobody.

// So every way of writing is either reachable from a screen or written down here as not yet, with the reason. The list may shrink and must never grow quietly.
const repoRoot = process.cwd()

type AWayOfWriting = { module: string; name: string }

function everyFileUnder(from: string, matching: RegExp): Array<string> {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)

    if (entry.isDirectory()) {
      return everyFileUnder(path, matching)
    }

    return matching.test(entry.name) ? [path] : []
  })
}

function waysOfWriting(): Array<AWayOfWriting> {
  const found: Array<AWayOfWriting> = []

  for (const path of everyFileUnder(join(repoRoot, 'convex'), /^mutations\.ts$/)) {
    const module = path.split('/convex/')[1].replace('/mutations.ts', '')
    const source = readFileSync(path, 'utf8')

    for (const [, name] of source.matchAll(/^export const (\w+) = \w*[Mm]utation\(/gm)) {
      found.push({ module, name })
    }
  }

  return found
}

function whatTheScreensCall(): Set<string> {
  const called = new Set<string>()

  for (const path of everyFileUnder(join(repoRoot, 'frontend', 'src'), /\.tsx?$/)) {
    const source = readFileSync(path, 'utf8')

    for (const [, module, name] of source.matchAll(/api\.([\w.]+)\.mutations\.(\w+)/g)) {
      called.add(`${module}.${name}`)
    }
  }

  return called
}

/** Written by something other than a person at a screen, each for a reason about what it is rather than about nobody having got to it. */
const NOT_FROM_A_SCREEN: Record<string, string> = {
  'accounts.rememberThisSignIn': 'the app itself, on the way in, so a sign-in is known before anything is asked of it',
  'accounts.upsert': 'the Clerk webhook, mirroring their record of a sign-in; no screen writes it and none should',
  'accounts.remove': 'the Clerk webhook again, when a sign-in is deleted at their end',
  'trades.seed': 'the list of trades every house starts with, written once when a deployment is empty',
}

/** No screen yet, and that is a gap rather than a decision. Lower this list; never add to it without saying why in a review. */
const NOBODY_CAN_REACH_YET: Record<string, string> = {
  'bankAccounts.hide': 'an account can be added from the day sheet and taken off nowhere',
  'bills.raise': 'a bill is what somebody says they are owed, and nothing asks for one',
  'bills.remove': 'and nothing takes one back',
  'engagements.agree': 'what was agreed with a contractor has no screen, so the spread reads agreed as nothing',
  'engagements.hide': 'nor a way to take it back',
  'moneyIn.remove': 'money coming in can be put in and never taken back out',
  'payments.remove': 'a payment can be put in and never taken out, and the removal is signed for nobody',
  'people.edit': 'a person can be added and hidden, and never corrected',
  'sites.edit': 'a house is named once and never renamed',
  'sites.hide': 'and never put away',
  'trades.add': 'the list of trades is what a deployment starts with and nothing more',
  'trades.hide': 'and nothing is taken off it',
  'trades.rename': 'and nothing is renamed',
}

const declared = waysOfWriting()
const reachable = whatTheScreensCall()

describe('every way of writing something down', () => {
  it('is reachable from a screen, or written down as not yet with the reason', () => {
    const unaccounted = declared
      .map((way) => `${way.module}.${way.name}`)
      .filter(
        (key) => !reachable.has(key) && NOT_FROM_A_SCREEN[key] === undefined && NOBODY_CAN_REACH_YET[key] === undefined
      )

    expect(unaccounted).toEqual([])
  })

  it('is looking at every mutation this repository has, rather than at none of them', () => {
    // The floor. If the matcher stopped matching, an empty list would read exactly like a clean tree.
    expect(declared.length).toBeGreaterThan(20)
    expect(declared.map((way) => `${way.module}.${way.name}`)).toContain('payments.record')
  })

  it('is reading the screens too, rather than counting everything as unreachable', () => {
    // The other half of the floor: a broken reader would put every mutation on the list below and look like a very honest audit.
    expect(reachable.has('payments.record')).toBe(true)
    expect(reachable.has('sites.start')).toBe(true)
    expect(reachable.size).toBeGreaterThan(3)
  })

  it('has nothing on both lists, and nothing on a list that is now reachable', () => {
    for (const key of Object.keys(NOT_FROM_A_SCREEN)) {
      expect(NOBODY_CAN_REACH_YET[key], `${key} is on both lists`).toBeUndefined()
    }

    // A gap that has been closed is a line to delete, and leaving it says the app is worse than it is.
    for (const key of Object.keys(NOBODY_CAN_REACH_YET)) {
      expect(reachable.has(key), `${key} is written down as unreachable and a screen now calls it`).toBe(false)
    }
  })

  it('knows which half of the ledger is missing, and says so rather than leaving it to be noticed', () => {
    // Not a formality: money coming in is the half the workbooks kept in a separate file, and it is the half nobody can enter today.
    expect(NOBODY_CAN_REACH_YET['engagements.agree']).toBeDefined()
    expect(NOBODY_CAN_REACH_YET['bills.raise']).toBeDefined()
    // And the one this guard was written for is off the list, because a screen now reaches it.
    expect(NOBODY_CAN_REACH_YET['moneyIn.record']).toBeUndefined()
  })
})
