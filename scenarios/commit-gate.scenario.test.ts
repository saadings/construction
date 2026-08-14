import { execFileSync } from 'node:child_process'
import { accessSync, chmodSync, constants, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { discardThrowaways, inThrowaway, stagedIn, throwawayRepository } from './throwaway'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

// Deliberately read-only. Proving the gate by committing in a throwaway repository is the pattern that leaks GIT_DIR into the real one.
function gitConfig(key: string): string {
  try {
    return execFileSync('git', ['config', key], { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const GATES = ['yarn lint:fix', 'yarn format:fix', 'yarn typecheck', 'yarn build', 'yarn test', 'yarn test:scenario']

describe('the gate every commit has to pass', () => {
  const hooksPath = gitConfig('core.hooksPath')

  it('is wired into this checkout, not merely declared in the manifest', () => {
    // The manifest naming husky under postinstall says the installer is meant to run. It does not say it ran.
    expect(hooksPath).toBe('.husky/_')
  })

  it('can read this repository, so an empty answer above would have been a failure', () => {
    // The control. gitConfig swallows a non-zero exit, so without this a git that could not run at all reads as an unset hooksPath.
    expect(gitConfig('core.bare')).toBe('false')
  })

  it('has a hook git will actually execute', () => {
    const shim = join(repoRoot, hooksPath, 'pre-commit')

    // Not executable and git skips it without a word, which is the same outcome as having no gate.
    expect(isExecutable(shim)).toBe(true)
    expect(readFileSync(shim, 'utf8')).toContain('/h')
  })

  it('runs the checks rather than being an empty file', () => {
    const hook = readFileSync(join(repoRoot, '.husky', 'pre-commit'), 'utf8')

    // husky exits 0 in silence when .husky/pre-commit is missing, so an absent gate and a passing one look identical.
    for (const gate of GATES) expect(hook).toContain(gate)
  })

  it('is not switched off in the environment this ran in', () => {
    // `[ "${HUSKY-}" = "0" ] && exit 0` in husky's own runner, which reports nothing when it fires.
    expect(process.env.HUSKY).not.toBe('0')
  })

  it('names gates this project actually has', () => {
    // The control for the check above. A renamed script would otherwise be asserted against a hook that no longer runs it.
    const scripts = (
      JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    ).scripts

    for (const gate of GATES) expect(scripts).toHaveProperty(gate.replace('yarn ', ''))
  })
})

describe('what the gate does to work it was not asked to commit', () => {
  afterEach(discardThrowaways)

  // Tracked, modified and deliberately unstaged: it stands in for another session's work in a shared tree.
  const BYSTANDER = 'halfFinished.txt'
  const IN_PROGRESS = 'work in progress\n'

  /** Every value the bystander held at the moments the gate reached for a command, read from inside the run. */
  function contentSeenDuringTheRun(dir: string): Array<string> {
    const bin = join(dir, 'watching')
    const witness = join(dir, 'witness.txt')
    const bystander = join(dir, BYSTANDER)

    mkdirSync(bin, { recursive: true })

    for (const command of ['yarn', 'npx']) {
      const script = [
        '#!/bin/sh',
        `cat "${bystander}" >> "${witness}" 2>/dev/null || printf 'GONE\\n' >> "${witness}"`,
        'exit 0',
        '',
      ].join('\n')
      writeFileSync(join(bin, command), script)
      chmodSync(join(bin, command), 0o755)
    }

    execFileSync('sh', ['-e', join(repoRoot, '.husky', 'pre-commit')], {
      cwd: dir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...inThrowaway(dir), PATH: `${bin}:${inThrowaway(dir).PATH ?? ''}` },
    })

    return readFileSync(witness, 'utf8')
      .split('\n')
      .filter((line) => line.length > 0)
  }

  it('never takes it out of the tree, not even for the length of a check', () => {
    const dir = throwawayRepository()

    const seen = contentSeenDuringTheRun(dir)

    // The control: the gate really did reach for its commands, so an empty list would mean nothing was watched rather than nothing moved.
    expect(seen.length).toBeGreaterThanOrEqual(3)

    // Restored-afterwards and never-touched are identical once the hook has exited, which is why this is asserted from inside the run.
    expect([...new Set(seen)]).toEqual([IN_PROGRESS.trimEnd()])

    // And it is still there at the end, still unstaged, exactly as it was.
    expect(readFileSync(join(dir, BYSTANDER), 'utf8')).toBe(IN_PROGRESS)
    expect(stagedIn(dir)).not.toContain(BYSTANDER)
  })
})
