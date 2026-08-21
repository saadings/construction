import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { everyFileHere } from './everyFileHere'
import { gitIn, inThrowaway } from './throwaway'
import { jobsIn, readWorkflow } from './workflowFile'

// A push deploys what the filter step says changed. Say nothing changed and every deploy step skips, correctly, and the run is green — so a path class nobody listed ships nowhere and the badge cannot tell you.

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

// The filter was its own job until a push became one runner; it is a step now, found by what it writes rather than by a job name.
const script = jobsIn(readWorkflow(repoRoot, 'deploy.yml'))
  .flatMap((job) => job.runs)
  .find((run) => run.includes('backend=$backend') && run.includes('GITHUB_OUTPUT'))

const made: Array<string> = []

afterEach(() => {
  while (made.length > 0) {
    rmSync(made.pop()!, { recursive: true, force: true })
  }
})

type Deploys = { backend: boolean; frontend: boolean }

/** An empty repository that is not this one, committed once so there is something to diff against. */
function aRepositoryOfItsOwn(): string {
  const dir = mkdtempSync(join(tmpdir(), 'construction-deploys-'))
  made.push(dir)

  // Not gitIn: the repository does not exist yet, so GIT_DIR cannot be pinned to it.
  execFileSync('git', ['init', '--quiet', dir], { encoding: 'utf8', env: inThrowaway(dir) })
  gitIn(dir, 'config', 'user.email', 'checks@example.invalid')
  gitIn(dir, 'config', 'user.name', 'Checks')
  return dir
}

/** What the workflow's own script decides, run against a repository whose one commit touched exactly these paths. */
function deploysAfterTouching(paths: Array<string>): Deploys {
  const dir = aRepositoryOfItsOwn()

  writeFileSync(join(dir, 'alreadyHere.txt'), 'first\n')
  gitIn(dir, 'add', '.')
  gitIn(dir, 'commit', '--quiet', '-m', 'before')
  const before = gitIn(dir, 'rev-parse', 'HEAD').trim()

  for (const path of paths) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), 'changed\n')
  }
  gitIn(dir, 'add', '.')
  gitIn(dir, 'commit', '--quiet', '-m', 'after')

  return decided(dir, { BEFORE: before, AFTER: gitIn(dir, 'rev-parse', 'HEAD').trim() })
}

/** Runs the script the way the job does, reading its answer out of the file it writes rather than its output. */
function decided(dir: string, commits: { BEFORE: string; AFTER: string }): Deploys {
  const answers = join(dir, 'github-output')
  writeFileSync(answers, '')
  execFileSync('bash', ['-c', script!], {
    cwd: dir,
    encoding: 'utf8',
    // The script shells out to git, so it has to be aimed the same way every other command here is.
    env: { ...inThrowaway(dir), ...commits, GITHUB_OUTPUT: answers },
  })

  const written = readFileSync(answers, 'utf8')
  const said = (name: string): boolean => {
    const answer = new RegExp(`^${name}=(true|false)$`, 'm').exec(written)
    // Absent is not false: a script that stopped writing this key would otherwise read as a deliberate no.
    expect(answer, `${name} was never written to GITHUB_OUTPUT:\n${written}`).not.toBeNull()
    return answer![1] === 'true'
  }

  return { backend: said('backend'), frontend: said('frontend') }
}

describe('what a push decides to deploy', () => {
  it('has a script in the workflow to decide it at all', () => {
    // Everything below runs `script`. Undefined, and each of them would fail for that reason and read like the filter is wrong.
    expect(script).toBeDefined()
    expect(script).toContain('backend=')
    expect(script).toContain('frontend=')
  })

  it.each([
    ['a document', 'docs/whatWeAgreed.md'],
    ['a scenario suite', 'scenarios/what-a-change-deploys.scenario.test.ts'],
  ])('deploys nothing for %s, which neither side compiles', (_what, path) => {
    // The control that makes every assertion below mean something: the script can say no, so a yes is a decision rather than a default.
    expect(deploysAfterTouching([path])).toEqual({ backend: false, frontend: false })
  })

  it('deploys the backend for a change under convex', () => {
    expect(deploysAfterTouching(['convex/sites/queries.ts'])).toEqual({ backend: true, frontend: false })
  })

  it('deploys the frontend for a change under frontend', () => {
    expect(deploysAfterTouching(['frontend/src/routes/index.tsx'])).toEqual({ backend: false, frontend: true })
  })

  it('deploys both sides for a change under shared, because both sides import it', () => {
    // `shared/validation` is where a rule about money or a covered area lives, and convex and the bundle each compile their own copy of it.
    expect(deploysAfterTouching(['shared/validation/site.ts'])).toEqual({ backend: true, frontend: true })
  })

  it('deploys both sides when the lockfile moves', () => {
    expect(deploysAfterTouching(['yarn.lock'])).toEqual({ backend: true, frontend: true })
  })

  it('does not call the root-file list `shared`, which is the name of a directory it does not match', () => {
    // How this survived every reading of the file: both filters mention `shared`, so the directory looks handled while the variable means four files at the root.
    expect(script).not.toMatch(/^\s*shared=/m)
  })

  it('deploys everything when there is no previous commit to compare against', () => {
    const dir = aRepositoryOfItsOwn()
    for (const path of ['convex/schema.ts', 'frontend/index.html']) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), 'first\n')
    }
    gitIn(dir, 'add', '.')
    gitIn(dir, 'commit', '--quiet', '-m', 'first')

    // A first push reports all zeroes and a force-push can leave a commit that is gone; both must deploy rather than skip.
    const head = gitIn(dir, 'rev-parse', 'HEAD').trim()

    expect(decided(dir, { BEFORE: '0'.repeat(40), AFTER: head })).toEqual({ backend: true, frontend: true })
  })
})

describe('every path the two sides are built from is claimed by the filter', () => {
  // The list above is written by hand, so it goes stale silently. This asks the repository instead: a new top-level directory that either side compiles has to be claimed by somebody.
  const COMPILED_BY_NEITHER = ['docs', 'scenarios', 'workbooks']

  it('leaves no directory that convex or the bundle imports unclaimed', () => {
    // Untracked too: a new top-level directory arrives as an untracked file first, which is exactly when nobody has claimed it yet.
    const tracked = everyFileHere(repoRoot)
    const imported = new Set<string>()

    for (const file of tracked) {
      if (!/^(convex|frontend)\/.*\.(ts|tsx)$/.test(file)) continue
      for (const [, specifier] of readFileSync(join(repoRoot, file), 'utf8').matchAll(/from\s+'([^']+)'/g)) {
        // Resolved, never counted: `../../utils/x` inside frontend/src is still frontend, and the number of `../` cannot say which.
        if (!specifier.startsWith('.')) continue
        const top = relative(repoRoot, resolve(dirname(join(repoRoot, file)), specifier)).split('/')[0]
        if (top !== 'convex' && top !== 'frontend' && !top.startsWith('..')) imported.add(top)
      }
    }

    // The canary: pointed at a tree it cannot read, this finds nothing and passes. `shared` is imported by both sides today.
    expect(imported).toContain('shared')

    const unclaimed = [...imported]
      .filter((directory) => !COMPILED_BY_NEITHER.includes(directory))
      .filter((directory) => !new RegExp(`\\^\\(?${directory}/`).test(script ?? ''))

    expect(unclaimed, `imported by convex or the bundle and deployed by nothing: ${unclaimed.join(', ')}`).toEqual([])
  })
})
