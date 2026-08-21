import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const WRAPPER = 'scripts/oneAtATime.sh'

// Two sessions work on this repository at once and neither knows the other exists. Gating together took the machine from a resting load of 9 to 42, with `userEvent` tests that take one second taking twenty-two -- and a failure set that changed on every run while the code did not: 0, then 3, then 13, then 2, every one a timeout. The same commit with one suite running passed 1258 and 191.

// This is the test of the thing that stops it, and there is one way to write it wrong: run it inside the lock. `yarn test:scenario` takes the lock, so every call below would inherit `ONE_AT_A_TIME_HELD` and pass straight through -- five green assertions about a wrapper that did nothing.

// So every call here is made with that variable removed, and against a lock path of its own. The second half is the standing rule about machine-global names, which this wrapper deliberately breaks and its test must not: two sessions running this suite at once would otherwise queue on each other's test lock and measure that instead.
const held = new Set<string>()

function aLockOfItsOwn(): string {
  const where = join(mkdtempSync(join(tmpdir(), 'one-at-a-time-')), 'lock')
  held.add(where)

  return where
}

// Both streams, always. `execFileSync` hands back stdout alone and only carries stderr on a throw -- so what the wrapper says about a stale lock, which it says on stderr because it is not the command's own output, was invisible on every run that worked. Two assertions passed the wrong way round before this: `took it` was there and the sentence explaining why was not.
function run(where: string, argv: Array<string>): { out: string; code: number } {
  const without: NodeJS.ProcessEnv = { ...process.env, ONE_AT_A_TIME_LOCK: where }
  delete without.ONE_AT_A_TIME_HELD

  const answered = spawnSync('sh', [WRAPPER, ...argv], { cwd: repoRoot, env: without, encoding: 'utf8' })

  return { out: `${answered.stdout}${answered.stderr}`, code: answered.status ?? 1 }
}

afterEach(() => {
  for (const where of held) {
    rmSync(join(where, '..'), { recursive: true, force: true })
  }

  held.clear()
})

describe('one heavy thing at a time', () => {
  it('runs what it was given, and lets the lock go afterwards', () => {
    const where = aLockOfItsOwn()

    expect(run(where, ['echo', 'ran']).out).toContain('ran')
    // Released, or the next gate on this machine waits forever on a run that finished.
    expect(() => readFileSync(join(where, 'pid'), 'utf8')).toThrow()
  })

  it('hands back what the command answered, so a failing gate still fails', () => {
    // The one thing a wrapper must not do. A lock that swallows the exit code turns every red gate green, silently, and the hook would commit anyway.
    const where = aLockOfItsOwn()

    expect(run(where, ['sh', '-c', 'exit 3']).code).toBe(3)
  })

  it('waits for a live holder rather than running alongside it', async () => {
    const where = aLockOfItsOwn()
    const without: NodeJS.ProcessEnv = { ...process.env, ONE_AT_A_TIME_LOCK: where }
    delete without.ONE_AT_A_TIME_HELD

    const first = spawn('sh', [WRAPPER, 'sh', '-c', 'sleep 3'], { cwd: repoRoot, env: without })
    await new Promise((wait) => setTimeout(wait, 700))

    const began = Date.now()
    const second = run(where, ['echo', 'second'])
    const waited = Date.now() - began

    first.kill()

    expect(second.out).toContain('second')
    // The whole point. Two suites at once is what produced a failure set nobody could read.
    expect(waited).toBeGreaterThan(1_000)
  }, 30_000)

  it('takes a lock left behind by something that died', () => {
    // A killed run cannot always release, and a session waiting on a dead holder is worse than the contention it was avoiding. Asked of the process rather than of an age: an age is a guess about how long a gate ought to take, and a gate is the thing with no such number.
    const where = aLockOfItsOwn()

    // Built with `fs` rather than by shelling out. A command here would have to say which repository it means -- the rule that stops a scenario running git against the real one -- and these want no repository at all, so the honest answer is not to make a command.
    mkdirSync(where, { recursive: true })
    writeFileSync(join(where, 'pid'), '999999\n')

    const answered = run(where, ['echo', 'took it'])

    expect(answered.out).toContain('took it')
    expect(answered.out).toContain('left its lock behind')
  })

  it('takes a lock nobody finished writing', () => {
    // A directory with no pid in it: created, and then the writer died between the two steps.
    const where = aLockOfItsOwn()
    mkdirSync(where, { recursive: true })

    expect(run(where, ['echo', 'took it']).out).toContain('nobody in it')
  })

  it('does not wait for itself when something inside it asks again', () => {
    // The hook takes the lock and then runs `yarn test`, which is wrapped too. Without this it waits for itself forever, which is a worse failure than the contention.
    const where = aLockOfItsOwn()

    expect(run(where, ['sh', WRAPPER, 'echo', 'inner ran']).out).toContain('inner ran')
  })

  it('is what the heavy commands actually run through', () => {
    // The wrapper existing and being correct says nothing about whether anything uses it, which is the shape this repository keeps meeting: a guard whose subject is not attached to it.
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const scripts = manifest.scripts

    for (const heavy of ['gate', 'test', 'test:scenario', 'build', 'gallery:build', 'shots', 'columns']) {
      expect(scripts[heavy], `${heavy} runs without the lock`).toContain(WRAPPER)
    }

    // And a single file is deliberately not on that list: `yarn vitest run <one>` is seconds, and making it queue behind a nine-minute gate is how somebody stops using the lock.
    expect(scripts['test:watch']).not.toContain(WRAPPER)
  })

  it('is what the commit hook runs the whole of itself through', () => {
    const hook = readFileSync(join(repoRoot, '.husky/pre-commit'), 'utf8')

    // One lock around all of it, taken by re-running the hook through the wrapper. Wrapping the stages instead would take and release it nine times, another session slips in between two of them, and both suites run anyway -- and the expensive part is the fixers rather than the checks: `lint:fix` is 98.8s of a 218s hook, against 13.8 for the typecheck and 12.3 for the build.

    // Counted on the invocation rather than on the name, because the name also appears in the comment explaining the invocation -- a sweep of source counts prose too, and this file tripped its own assertion on its own paragraph.
    const taken = hook.match(/exec sh "\$here\/scripts\/oneAtATime\.sh" sh "\$0"/g) ?? []

    expect(taken).toHaveLength(1)

    // Resolved from the hook's own path and not from the working directory, which is the difference between working under husky and working anywhere. A scenario that runs this hook from elsewhere is what found it.
    expect(hook).toContain('dirname -- "$0"')
  })
})
