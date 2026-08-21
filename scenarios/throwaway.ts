import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Anything exercising the commit gate needs a repository that is not this one, and one isolation mechanism rather than two.

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

const made: Array<string> = []

/** The line a `git add -p` was told to leave behind. */
export const DECLINED = 'EXPERIMENT_NOT_FOR_COMMIT'

// cwd does not decide which repository git acts on — GIT_DIR does, and a pre-commit hook exports it to everything it starts.
export function inThrowaway(dir: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  // Stripped by pattern, never by name: GIT_INDEX_FILE alone empties the wrong index even with GIT_DIR pinned correctly.
  for (const [name, value] of Object.entries(inherited)) {
    if (!/^GIT_/.test(name)) env[name] = value
  }
  env.GIT_DIR = join(dir, '.git')
  env.GIT_WORK_TREE = dir
  return env
}

// The only route to git for a throwaway, so a bare call is impossible rather than merely absent.
export function gitIn(dir: string, ...args: Array<string>): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: inThrowaway(dir) })
}

/** Stands in for the slow commands so the hook's staging can be exercised on its own. */
export function shimsFor(dir: string, commands: Array<string>, status = 0): string {
  const bin = join(dir, 'shims')
  mkdirSync(bin, { recursive: true })

  for (const command of commands) {
    const path = join(bin, command)
    writeFileSync(path, `#!/bin/sh\nexit ${status}\n`)
    chmodSync(path, 0o755)
  }

  return bin
}

/** Stands in for the slow commands, failing for one stage only. */
export function shimsFailingOn(dir: string, commands: Array<string>, stage: string): string {
  const bin = join(dir, 'shims')
  mkdirSync(bin, { recursive: true })

  // A shim that fails everything cannot see a gate that does not stop: the last stage fails too, so the hook's exit status is non-zero either way and a gate that ignored every earlier failure would still look like one that refused.
  for (const command of commands) {
    const path = join(bin, command)
    writeFileSync(path, `#!/bin/sh\n[ "$1" = '${stage}' ] && exit 1\nexit 0\n`)
    chmodSync(path, 0o755)
  }

  return bin
}

// Puts the shims first without letting the environment be rebuilt from an ambient one, and gives the hook a lock nobody else can be holding.

// The lock path matters as much as the PATH does. The hook re-execs itself through the wrapper, so a scenario running it takes the machine-global lock and queues behind whatever else is gating -- which under `yarn test:scenario` is invisible, because the variable is already set and the hook falls straight through, and which on a single-file run is a wait long enough to exceed the test timeout. Seen once as a 244-second run and a failure in a test that passes alone.
function reachingFirstFor(env: NodeJS.ProcessEnv, bin: string): NodeJS.ProcessEnv {
  return { ...env, PATH: `${bin}:${env.PATH ?? ''}`, ONE_AT_A_TIME_LOCK: join(bin, '..', 'lock') }
}

// A tree partway through something: one file staged, one deliberately left alone, and one staged in part as `git add -p` leaves it.
export function throwawayRepository(): string {
  const dir = mkdtempSync(join(tmpdir(), 'construction-hook-'))
  made.push(dir)

  // Not gitIn: the repository does not exist yet, so GIT_DIR cannot be pinned to it.
  execFileSync('git', ['init', '--quiet', dir], { encoding: 'utf8', env: inThrowaway(dir) })
  gitIn(dir, 'config', 'user.email', 'checks@example.invalid')
  gitIn(dir, 'config', 'user.name', 'Checks')

  writeFileSync(join(dir, 'meantToCommit.txt'), 'first\n')
  writeFileSync(join(dir, 'halfFinished.txt'), 'first\n')
  writeFileSync(join(dir, 'partlyStaged.txt'), 'first\n')
  gitIn(dir, 'add', '.')
  gitIn(dir, 'commit', '--quiet', '-m', 'first')

  writeFileSync(join(dir, 'meantToCommit.txt'), 'second\n')
  gitIn(dir, 'add', 'meantToCommit.txt')
  writeFileSync(join(dir, 'halfFinished.txt'), 'work in progress\n')

  writeFileSync(join(dir, 'partlyStaged.txt'), 'second\n')
  gitIn(dir, 'add', 'partlyStaged.txt')
  writeFileSync(join(dir, 'partlyStaged.txt'), `second\n${DECLINED}\n`)

  return dir
}

// Both hook invocations go through here: they hand a rebuilt environment to a script that stages and stashes.
export function runHook(dir: string, { failing = false } = {}): void {
  const bin = shimsFor(dir, ['yarn', 'npx'], failing ? 1 : 0)

  execFileSync('sh', ['-e', join(repoRoot, '.husky', 'pre-commit')], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'pipe',
    env: reachingFirstFor(inThrowaway(dir), bin),
  })
}

// The re-exec is deliberately left in the path, because that is where `-e` was lost. `ONE_AT_A_TIME_HELD` has to go with it, or the hook falls straight through to the work carrying husky's flags intact -- which is the arrangement that hid this in the first place, and would have made the assertion pass over a hook that had never been fixed.
function withoutTheLockHeld(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const copy = { ...env }
  delete copy.ONE_AT_A_TIME_HELD

  return copy
}

/** What the hook answers git, run the way husky runs it and allowed to re-exec through the lock. */
export function hookExitCode(dir: string, bin: string): number {
  // Aimed in the call itself rather than through a variable holding the same thing: the guard on this directory reads the text of each call, and a reader who cannot see where a command points is the reason that guard exists.
  const answered = spawnSync('sh', ['-e', join(repoRoot, '.husky', 'pre-commit')], {
    cwd: dir,
    encoding: 'utf8',
    env: withoutTheLockHeld(reachingFirstFor(inThrowaway(dir), bin)),
  })

  return answered.status ?? 1
}

export function stagedIn(dir: string): Array<string> {
  return gitIn(dir, 'diff', '--cached', '--name-only')
    .split('\n')
    .filter((line) => line.length > 0)
    .sort()
}

export function discardThrowaways(): void {
  while (made.length > 0) {
    rmSync(made.pop()!, { recursive: true, force: true })
  }
}
