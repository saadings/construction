import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// A table with a mutation and no screen is a table nobody can put anything in. It passes every test it has, deploys, and does nothing -- which is what `moneyIn` did for a day: money coming in could be recorded by nobody.

// So every way of writing is either reachable from a screen or marked in the file it lives in, with the reason. A reading nobody opens is the same defect from the other side, and is held to the same rule.

// Every check here is asked from both ends and the two answers are required to agree, which is the one shape a broken instrument cannot satisfy: breaking it moves one count and not the other. Asked from a single end, each of these went quiet at least once -- a floor that counted the way the broken sweep counted, a list that could be satisfied by deleting a line, a marker that matched a definition rather than a use, an exemption that outlived its reason. None of them failed. They agreed with themselves.
const repoRoot = process.cwd()

// The reason lives above the function it is about rather than in a list here. Two things follow, and both were paid for before the move: closing a gap edits only the module somebody was already editing, so no two changes meet in this file; and the reason is where anybody reading the function will see it, which is the only place it was ever useful -- nobody opens a scenario test to find out why a mutation has no screen.
type Excuse = 'not-yet' | 'not-from-a-screen'

type AWayOfWriting = { module: string; name: string; excuse?: Excuse; reason?: string }

function everyFileUnder(from: string, matching: RegExp): Array<string> {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)

    if (entry.isDirectory()) {
      return everyFileUnder(path, matching)
    }

    return matching.test(entry.name) ? [path] : []
  })
}

type Kind = 'mutations' | 'queries'

const DECLARES: Record<Kind, RegExp> = {
  mutations: /^export const (\w+) = \w*[Mm]utation\(/,
  queries: /^export const (\w+) = \w*[Qq]uery\(/,
}

const MARKED = /^\/\/ (not-yet|not-from-a-screen): (.+)$/

// Every file, not only the ones called `mutations.ts`. `accounts/actions.ts` holds two of them, and a sweep that looks only where they are usually kept reports a clean tree about a file it never opened.
function waysOf(kind: Kind): Array<AWayOfWriting> {
  const found: Array<AWayOfWriting> = []

  for (const path of everyFileUnder(join(repoRoot, 'convex'), /\.ts$/)) {
    const inside = path.split('/convex/')[1]
    if (inside.startsWith('_generated/') || inside.endsWith('.test.ts')) {
      continue
    }

    // Named by the table it touches rather than by the file it sits in, which is how a screen names it.
    const module = inside.split('/').slice(0, -1).join('/')
    const lines = readFileSync(path, 'utf8').split('\n')

    for (const [at, line] of lines.entries()) {
      const declares = DECLARES[kind].exec(line)
      if (declares === null) continue

      // Read off the line above the declaration and nowhere else. A marker floating anywhere in a file could outlive what it was written about, which is the phantom entry all over again in a new place.
      const marked = MARKED.exec(lines[at - 1]?.trim() ?? '')

      found.push({
        module,
        name: declares[1],
        excuse: marked === null ? undefined : (marked[1] as Excuse),
        reason: marked?.[2],
      })
    }
  }

  return found
}

function whatTheScreensCall(kind: Kind): Set<string> {
  const called = new Set<string>()
  const reaches = new RegExp(String.raw`api\.([\w.]+)\.${kind}\.(\w+)`, 'g')

  for (const path of everyFileUnder(join(repoRoot, 'frontend', 'src'), /\.tsx?$/)) {
    const source = readFileSync(path, 'utf8')

    for (const [, module, name] of source.matchAll(reaches)) {
      called.add(`${module}.${name}`)
    }
  }

  return called
}

const named = (way: AWayOfWriting) => `${way.module}.${way.name}`

const declared = waysOf('mutations')
const reachable = whatTheScreensCall('mutations')

const readings = waysOf('queries')
const opened = whatTheScreensCall('queries')

const everything = [...declared, ...readings]

describe('every way of writing something down', () => {
  it('is reachable from a screen, or marked in its own file with the reason', () => {
    const unaccounted = declared.filter((way) => !reachable.has(named(way)) && way.excuse === undefined).map(named)

    expect(unaccounted).toEqual([])
  })

  it('is looking at every mutation this repository has, rather than at none of them', () => {
    // The floor. If the matcher stopped matching, an empty list would read exactly like a clean tree.
    expect(declared.length).toBeGreaterThan(20)
    expect(declared.map(named)).toContain('payments.record')
    // And one that is not in a file called `mutations.ts`. Looking only where they are usually kept is how two of them went unswept.
    expect(declared.map(named)).toContain('accounts.upsert')
  })

  it('is reading the screens too, rather than counting everything as unreachable', () => {
    // The other half of the floor: a broken reader would mark every mutation as unreachable and look like a very honest audit.
    expect(reachable.has('payments.record')).toBe(true)
    expect(reachable.has('sites.start')).toBe(true)
    expect(reachable.size).toBeGreaterThan(3)
  })

  it('has nothing marked as not yet that a screen now reaches', () => {
    // A gap that has been closed is a marker to delete, and leaving it says the app is worse than it is.
    for (const way of declared.filter((one) => one.excuse === 'not-yet')) {
      expect(reachable.has(named(way)), `${named(way)} is marked as not yet and a screen now calls it`).toBe(false)
    }
  })

  it('has nothing left marked as not yet at all', () => {
    // The markers started as an apology for half the ledger, came down to the two ways of paying a partner his share, and are now none. What is left in the tree is `not-from-a-screen`, which is a different claim: those are written by the app itself and no screen should reach them.
    expect(
      declared
        .filter((way) => way.excuse === 'not-yet')
        .map(named)
        .sort()
    ).toEqual([])
  })

  it('has the gaps it was written about closed from both sides, not only unmarked', () => {
    // A marker deleted and a screen that reaches the function are two different facts, and only one of them is what the app can do. Asserted separately, because deleting a marker is the easy half and it is the half that makes the guard go quiet.

    // `profitPayouts.record` and `.remove` are the case that proves why both halves are needed. They were marked, so nothing here complained, and they had seven call-sites -- every one of them a test. In production `paidPaisa` was structurally zero for good, so the partners' table said every one of them was owed the whole of his share, on the single screen that matters on the day a house sells.
    const marked = new Set(declared.filter((way) => way.excuse !== undefined).map(named))

    for (const key of [
      'moneyIn.record',
      'bills.raise',
      'bills.remove',
      'engagements.agree',
      'profitPayouts.record',
      'profitPayouts.remove',
    ]) {
      expect(marked.has(key), `${key} is still marked as a gap`).toBe(false)
      expect(reachable.has(key), `${key} is unmarked and no screen reaches it`).toBe(true)
    }
  })
})

describe('every way of reading something back', () => {
  it('is opened by a screen, or marked in its own file with the reason', () => {
    const unopened = readings.filter((way) => !opened.has(named(way)) && way.excuse === undefined).map(named)

    expect(unopened).toEqual([])
  })

  it('is looking at every reading this repository has, rather than at none of them', () => {
    // The floor. A matcher that stopped matching would report the same clean result as a tree with nothing wrong in it.
    expect(readings.length).toBeGreaterThan(10)
    expect(readings.map(named)).toContain('payments.totals')
    expect(readings.map(named)).toContain('owed.statement')
  })

  it('is reading the screens too, rather than counting every reading as unopened', () => {
    // The other half of the floor: a broken reader would mark every query as unopened and look like a very honest audit.
    expect(opened.has('sites.all')).toBe(true)
    expect(opened.has('owed.statement')).toBe(true)
    expect(opened.size).toBeGreaterThan(3)
  })

  it('has nothing marked at all, because every reading is opened by a screen', () => {
    expect(readings.filter((way) => way.excuse !== undefined).map(named)).toEqual([])
  })

  it('knows the readings it was added for are reachable now, from both sides', () => {
    // Both halves of what the workbooks were kept open for -- one man's account and what is owed altogether -- the spread this half of the guard found on its first run, what has come in on a house, and what has gone back out of it to the partners.
    for (const key of [
      'owed.statement',
      'owed.position',
      'engagements.spread',
      'moneyIn.totals',
      'profitPayouts.forSite',
    ]) {
      const reading = readings.find((way) => named(way) === key)

      expect(reading, `${key} is not a way of reading anything`).toBeDefined()
      expect(reading?.excuse, `${key} is still marked`).toBeUndefined()
      expect(opened.has(key), `${key} is unmarked and no screen opens it`).toBe(true)
    }
  })
})

describe('the markers themselves', () => {
  it('cannot excuse something this repository does not have', () => {
    // `trades.rename` sat on the old central list as a known gap and was never a function at all -- a line describing work that would never be done, for somebody to act on in good faith. A marker is read off the line above a declaration, so it cannot name a missing function; what it can still do is sit somewhere no declaration follows, where it excuses nothing and reads as though it does.

    // Counted from the other end on purpose: every marker written anywhere under `convex/`, against the ones the sweep above actually attached to something.
    let written = 0

    for (const path of everyFileUnder(join(repoRoot, 'convex'), /\.ts$/)) {
      const inside = path.split('/convex/')[1]
      if (inside.startsWith('_generated/') || inside.endsWith('.test.ts')) continue

      written += readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => MARKED.test(line.trim())).length
    }

    const attached = everything.filter((way) => way.excuse !== undefined)

    expect(written).toBe(attached.length)
    // And the count is of something, so this cannot pass by both ends being zero. Both of them are counted with `MARKED`, so a regex that stopped matching would zero the pair and the equality above would agree with itself.

    // Four are left, all `not-from-a-screen`, so this floor is one below what the tree holds. Closing another one legitimately fails here, and the answer then is to lower it by hand rather than to go looking for a broken sweep -- what it is guarding is the counter, not the number.
    expect(written).toBeGreaterThan(3)
  })

  it('says something, rather than being a bare word standing in for a reason', () => {
    for (const way of everything.filter((one) => one.excuse !== undefined)) {
      expect((way.reason ?? '').length, `${named(way)} is marked with no reason worth reading`).toBeGreaterThan(20)
    }
  })

  it('is read off the line above the declaration and nowhere else', () => {
    // The control for the rule that makes a phantom impossible. A marker anywhere else in the file is not a marker, or it would outlive what it was written about.
    const seed = readFileSync(join(repoRoot, 'convex', 'trades', 'mutations.ts'), 'utf8')

    expect(seed).toMatch(/\/\/ not-from-a-screen: [^\n]+\nexport const seed = /)
  })
})
