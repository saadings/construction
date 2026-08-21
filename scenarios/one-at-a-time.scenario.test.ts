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

// Every call is bounded, and the reason is not tidiness: `spawnSync` blocks this thread and vitest cannot interrupt a synchronous call, so its own test timeout never fires and a wrapper that waits for ever makes the whole suite hang for ever instead of failing. That is worse than a red, because a hang in CI stops the queue and says nothing about why -- and it happened here for eight minutes before the zombie check was fixed. Twenty-five seconds is longer than the slowest honest wait in this file, which is the ten an empty lock is given before it is believed abandoned.
const LONGER_THAN_ANY_HONEST_WAIT = 25_000

function run(where: string, argv: Array<string>): { out: string; code: number } {
  const without: NodeJS.ProcessEnv = { ...process.env, ONE_AT_A_TIME_LOCK: where }
  delete without.ONE_AT_A_TIME_HELD

  const answered = spawnSync('sh', [WRAPPER, ...argv], {
    cwd: repoRoot,
    env: without,
    encoding: 'utf8',
    timeout: LONGER_THAN_ANY_HONEST_WAIT,
  })

  // Put into what the assertions read, because a wrapper that never came back is otherwise indistinguishable from one that came back saying the wrong thing.
  const gaveUp =
    answered.signal === null ? '' : `\n[the wrapper was still waiting after ${LONGER_THAN_ANY_HONEST_WAIT}ms and was killed]`

  return { out: `${answered.stdout}${answered.stderr}${gaveUp}`, code: answered.status ?? 1 }
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

  it('takes the lock of a holder that has exited but has not been collected', () => {
    // `kill -0` succeeds on a zombie, because a process that has exited still owns its pid until whatever started it collects it. So a holder that dies while its parent is busy elsewhere reads as alive for ever, and every run afterwards waits on a corpse. This suite produced one by accident and sat for eight minutes using no processor time at all, which is what a wait for the dead looks like from outside.
    const where = aLockOfItsOwn()
    mkdirSync(where, { recursive: true })

    // A child that exits at once and is deliberately never collected: `run` is `spawnSync` and blocks this thread, so node cannot reap it while the wrapper is looking at it. Nothing between the spawn and the call turns the event loop, which is what makes the reproduction exact rather than a matter of timing.
    const dead = spawn('sh', ['-c', 'exit 0'], { cwd: repoRoot })
    writeFileSync(join(where, 'pid'), `${dead.pid}\n`)

    const answered = run(where, ['echo', 'took it'])

    expect(answered.out).toContain('left its lock behind')
    expect(answered.out).toContain('took it')
  }, 30_000)

  it('waits for a lock that has only just been made, rather than taking it', async () => {
    // This assertion used to say the opposite, and the old expectation was itself the bug: it required an empty lock to be taken on sight. `mkdir` claims the lock and the pid is written on the next line, so every live lock is empty for that moment, and a caller that took it then ran alongside the holder -- the one thing this wrapper exists to prevent, with a green test saying it was intended.
    const where = aLockOfItsOwn()
    mkdirSync(where, { recursive: true })

    // A real live process to be the holder, writing its own pid a beat late, exactly as a shell does between its `mkdir` and its redirect. The claim has to come from another process rather than from a timer here: `run` is `spawnSync`, which blocks this thread, so a `setTimeout` meant to land in the middle of the wait does not run until the wait is over.
    const holder = spawn('sh', ['-c', 'sleep 1; echo $$ > "$LOCK/pid"; sleep 4'], {
      cwd: repoRoot,
      env: { ...process.env, LOCK: where },
    })

    const answered = run(where, ['echo', 'ran'])
    holder.kill()

    // It waited for the pid that turned up rather than taking the empty directory, which is the whole of the difference.
    expect(answered.out).toContain(`waiting for pid ${holder.pid}`)
    expect(answered.out).toContain('ran')
  }, 30_000)

  it('takes a lock that is still empty long after it was made', () => {
    // The accident the old assertion was reaching for, and caught far too eagerly: something really did die between making the lock and claiming it. Waited out rather than assumed, and said out loud when it happens, because a recovery nobody is told about is one nobody ever learns happened.
    const where = aLockOfItsOwn()
    mkdirSync(where, { recursive: true })

    const answered = run(where, ['echo', 'took it'])

    expect(answered.out).toContain('never claimed it')
    expect(answered.out).toContain('took it')
  }, 30_000)

  it('says who it is waiting for, and since when', async () => {
    // The waiting path was the one path whose message nothing read. Both stale paths assert the sentence they print; this one asserted only that the second command eventually ran, so a wrapper that waited in total silence -- or that named the wrong process -- was green. A wait with nothing on the screen is how somebody decides the machine has hung and reaches for the interrupt, which is how this becomes the thing nobody uses.
    const where = aLockOfItsOwn()
    const without: NodeJS.ProcessEnv = { ...process.env, ONE_AT_A_TIME_LOCK: where }
    delete without.ONE_AT_A_TIME_HELD

    const first = spawn('sh', [WRAPPER, 'sh', '-c', 'sleep 3'], { cwd: repoRoot, env: without })
    await new Promise((wait) => setTimeout(wait, 700))

    const second = run(where, ['echo', 'second'])
    first.kill()

    // `sh scripts/oneAtATime.sh` runs the script in that same shell, so the pid it writes is the pid node was handed back -- which is what makes this an assertion about the holder rather than about the shape of the sentence.
    expect(second.out).toContain(`waiting for pid ${first.pid}`)
    // A clock, not the fallback: `${since:-an unknown time}` renders a whole reassuring sentence when the file is missing, so a version that stopped writing `since` would still say something and say nothing.
    expect(second.out).toMatch(/gating since \d\d:\d\d:\d\d\./)
  }, 30_000)

  it('leaves the lock alone when it is no longer ours', () => {
    // The property the ownership check in `release` exists for, which nothing had ever asked for. A stale-takeover can hand the lock on while this run is still going, and removing it then lets two runs proceed -- the exact thing the wrapper exists to prevent, arriving through the tidying up, done by the run that looks innocent.
    const where = aLockOfItsOwn()

    // The takeover without the race that would produce it: the command overwrites the pid while the wrapper is still holding, so by the time `release` runs the lock belongs to somebody else.
    const somebodyElse = String(process.pid)
    const answered = run(where, ['sh', '-c', `echo ${somebodyElse} > "$ONE_AT_A_TIME_LOCK/pid"`])

    expect(answered.code).toBe(0)
    // Still there, and still theirs. Its complement is the first test in this file, which requires the lock to be gone after a run that did still hold it, and neither is worth much without the other.
    expect(readFileSync(join(where, 'pid'), 'utf8').trim()).toBe(somebodyElse)
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

    // One lock around all of it, taken by re-running the hook through the wrapper. Wrapping the stages instead would take and release it nine times, another session slips in between two of them, and both suites run anyway. The other half of the argument is that the fixers cost more than the checks, so a lock around the checks alone would leave most of the cost outside it -- one timing of the hook put `lint:fix` at 98.8s of 218s against 13.8 for the typecheck and 12.3 for the build.

    // Those seconds are one draw from another session's harness, and the stages have been seen to move by around 3.5x with what else is running on the machine, so they are not a constant and nothing here has shown the ordering survives that spread. They are quoted as the reason the whole hook is wrapped rather than its checks; a decision about which stage to cache needs its own timings, taken with nothing else running and as the minimum of several runs.

    // Counted on the invocation rather than on the name, because the name also appears in the comment explaining the invocation -- a sweep of source counts prose too, and this file tripped its own assertion on its own paragraph.
    const taken = hook.match(/exec sh "\$here\/scripts\/oneAtATime\.sh" sh "\$0"/g) ?? []

    expect(taken).toHaveLength(1)

    // Resolved from the hook's own path and not from the working directory, which is the difference between working under husky and working anywhere. A scenario that runs this hook from elsewhere is what found it.
    expect(hook).toContain('dirname -- "$0"')
  })
})
