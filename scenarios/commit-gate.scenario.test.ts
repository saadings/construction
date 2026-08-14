import { execFileSync } from 'node:child_process'
import { accessSync, constants, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

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
