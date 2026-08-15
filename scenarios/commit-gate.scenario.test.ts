import { execFileSync } from 'node:child_process'
import { accessSync, chmodSync, constants, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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

  it('generates the Convex types before anything reads them', () => {
    // A branch adding a table linted against last commit's types and died on 130 errors about `any`, none of them about the change. The gate was refusing work that was fine.
    const hook = readFileSync(join(repoRoot, '.husky', 'pre-commit'), 'utf8')

    const generated = hook.indexOf('convex codegen')
    const read = [...hook.matchAll(/yarn (lint:fix|typecheck|build|test)\b/g)].map((step) => step.index)

    // Absence asserted before order: `indexOf` answers -1 for a step that is gone, and -1 comes before everything.
    expect(generated).toBeGreaterThan(-1)
    expect(read.length).toBeGreaterThan(2)

    for (const step of read) expect(generated).toBeLessThan(step)
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

describe('what a scenario is allowed to write', () => {
  /** Every path a scenario hands to `writeFileSync`, resolved through a variable when it was assigned from one. */
  function writesIn(source: string): Array<string> {
    return [...source.matchAll(/writeFileSync\(\s*([^,]+),/g)].map((match) => {
      const target = match[1].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(target)) {
        // A bare name says nothing on its own. Read where it came from, because unreadable must not pass as harmless.
        const assigned = new RegExp(`\\b(?:const|let|var)\\s+${target}\\s*=\\s*([^\\n]+)`).exec(source)
        return assigned ? `${target} = ${assigned[1].trim()}` : `${target} = (assigned somewhere this cannot read)`
      }
      return target
    })
  }

  /** Every scenario write that lands somewhere the lint, typecheck and test runs are reading. */
  function intoTheTree(): Array<string> {
    return readdirSync(join(repoRoot, 'scenarios'))
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) =>
        writesIn(readFileSync(join(repoRoot, 'scenarios', name), 'utf8'))
          .filter((target) => target.includes('repoRoot') || target.includes('cannot read'))
          .map((target) => `${name} writes ${target}`)
      )
  }

  it('is only the two places a probe cannot be written anywhere else', () => {
    // Named rather than counted: an empty list is what a matcher that stopped reading returns, and these two prove it is still reading.
    expect(intoTheTree()).toEqual([
      "pipeline-contract.scenario.test.ts writes canary = join(repoRoot, 'convex', 'typecheckCanary.ts')",
      "repository-hygiene.scenario.test.ts writes control = join(repoRoot, 'scenarios', 'control.scenario.test.ts')",
    ])
  })

  it('reads a target through the name it was assigned to, so an unreadable one cannot pass as harmless', () => {
    // Composed rather than written out, because a fixture spelling the call in full reads to the scan above as a write this file makes.
    const CALL = 'writeFileSync'
    const named = writesIn(`const probe = join(repoRoot, 'convex', 'p.ts')\n${CALL}(probe, body)\n`)
    const opaque = writesIn(`${CALL}(somewhereElse, body)\n`)

    expect(named).toEqual(["probe = join(repoRoot, 'convex', 'p.ts')"])
    expect(opaque).toEqual(['somewhereElse = (assigned somewhere this cannot read)'])
  })
})
