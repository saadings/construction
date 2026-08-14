import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { readWorkflow, runStepsIn, workflowFiles } from './workflowFile'

/**
 * Checks that only mean anything against the real repository, so they run
 * against real git rather than a fixture.
 *
 * Nothing here is about whether the app works. Each one is a way this
 * repository quietly becomes unsafe or unbuildable without a single line of
 * application code changing:
 *
 *   - a bank statement or a credential reaches git history, where it is public
 *     forever in practice, because rewriting shared history is not a real option
 *   - an identifier belonging to the organisation the template came from
 *     survives, so this codebase is not actually cut loose from it
 *   - the pipeline reaches for an action this repository cannot resolve, and
 *     every job dies on its first step
 *
 * Every check carries a control that proves the instrument can see a failure.
 * A search that silently matches nothing and a repository that is genuinely
 * clean produce byte-identical output, so a bare "no matches" is worth nothing
 * on its own.
 */

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

function git(...args: Array<string>): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    // Whole-history diffs are far larger than the default 1 MB buffer, and
    // overflowing it throws rather than truncating — which would look like a
    // clean history.
    maxBuffer: 512 * 1024 * 1024,
  })
}

/**
 * Every history-based check below asks what this repository has ever
 * committed. A shallow clone answers with the working tree and looks
 * identical to a clean history, so the question has to be asked directly —
 * a commit count cannot distinguish a truncated clone from a young repo.
 *
 * The subject line is read from `--format=%s` rather than from a patch stream.
 * A patch stream carries the content of every tracked file, this one included,
 * so a control looking for a literal written here is satisfied by its own
 * source: in a depth-1 clone of this branch, `git log -p --all` matched the
 * old control twice with a single grafted commit behind it.
 */
function assertHistoryIsPresent(): void {
  expect(git('rev-parse', '--is-shallow-repository').trim()).toBe('false')
  expect(git('log', '--all', '--format=%s')).toContain('bring in the application codebase')
}

/** True when git would refuse to add this path. Untracked paths only. */
function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '--', path], { cwd: repoRoot })
    return true
  } catch {
    return false
  }
}

/** Every path that has ever appeared in any commit, not just the ones here now. */
function everyPathEverCommitted(): Array<string> {
  return git('log', '--all', '--name-only', '--format=')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * The prefixes of the credentials this project actually holds: a Cloudflare
 * API token, the Clerk secret and publishable keys, and the Clerk webhook
 * signing secret.
 *
 * The trailing run of token characters is the load-bearing part. Without it
 * this matches the implementation plan, which names these prefixes while
 * explaining how to search for them, and a check that cries wolf is a check
 * that gets deleted — which is how the real thing goes unnoticed later.
 */
const CREDENTIAL_SHAPE = /(cfat_|sk_test_|sk_live_|pk_test_|pk_live_|whsec_)[A-Za-z0-9_+/=-]{20,}/

/**
 * Identifiers belonging to the organisation the template was taken from — its
 * own name, the template's, its infrastructure prefix, and the ticket keys of
 * the products it builds. The last of those is how the first pass missed the
 * agent workflows: they carried no company name anywhere, only ticket keys
 * from another product's tracker, and a search for the company name reported a
 * clean tree.
 */
const ORIGIN_IDENTIFIER = /flatout|blueprint.?2|fsos|towd-[0-9]/i

/**
 * The template's own name, standing alone.
 *
 * The pattern above deliberately requires the `2`, because `blueprint` is an
 * ordinary English word and a check that fires on ordinary English is a check
 * that gets deleted. That narrowing is also exactly what let the banner
 * printed on every `yarn dev` go on announcing the template this codebase was
 * cut loose from, while the scan above reported a clean tree.
 *
 * So the bare word is banned in code as well. This app's vocabulary is sites,
 * trades, people and payments and has never needed it. If a screen ever does,
 * that should be a decision someone makes on purpose, and this is where they
 * will be asked to make it.
 */
const TEMPLATE_NAME = /blueprint/i

/**
 * A committed instruction to reach for npm. `frontend/.cta.json` carried one,
 * which the next `create-tsrouter-app` run would have obeyed — leaving a
 * package-lock.json beside yarn.lock for `yarn install --immutable` in CI to
 * disagree with.
 */
const NPM_AS_PACKAGE_MANAGER = /"packageManager": *"npm/

/**
 * Reads every file a fresh clone would receive and returns the ones matching.
 *
 * Searches what is staged rather than what is on disk. Those differ during
 * every commit — this runs in the pre-commit hook — and it is the staged
 * content that a clone ends up with. Reading the working tree also breaks
 * outright on a file staged for deletion, which is a very ordinary thing to be
 * doing when a check like this matters most.
 *
 * `docs/` is excluded because the design and plan discuss the template by
 * name; those mentions record a decision and are meant to stay. This file is
 * excluded because it necessarily contains the patterns it searches for.
 */
function trackedFilesMatching(pattern: RegExp): Array<string> {
  const args = ['grep', '--cached', '--files-with-matches', '--extended-regexp', '--null']
  if (pattern.flags.includes('i')) {
    args.push('--ignore-case')
  }
  args.push('-e', pattern.source, '--', ':!docs/', ':!scenarios/repository-hygiene.scenario.test.ts')

  let matches: string
  try {
    matches = git(...args)
  } catch (error) {
    // git grep exits 1 on no matches and 2 or above on a real failure. Only
    // the first is an answer; the rest have to surface, or a broken search
    // reads exactly like a clean repository.
    if ((error as { status?: number }).status === 1) {
      return []
    }
    throw error
  }

  return matches.split('\0').filter((path) => path.length > 0)
}

describe('secrets and source workbooks', () => {
  it('refuses to stage anything that carries the family finances or a credential', () => {
    const mustBeIgnored = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.local.backup',
      'construction account.xlsx',
      'DR.KHALID MIRZA.xlsx',
      'frontend/src/fixtures/payments.xlsx',
      'archive/2024.xls',
      '~$construction account.xlsx',
    ]

    const staged = mustBeIgnored.filter((path) => !isIgnored(path))

    expect(staged).toEqual([])
  })

  it('can tell an ignored path from one that is not', () => {
    // The control. Without it, a `check-ignore` invocation that always
    // reported "ignored" — wrong directory, wrong flag — would make the test
    // above pass while .gitignore was empty.
    expect(isIgnored('package.json')).toBe(false)
    expect(isIgnored('convex/schema.ts')).toBe(false)
  })

  it('keeps the example environment file committable', () => {
    // `.env.*` ignores everything; a single `!.env.example` negation is all
    // that keeps the one file people are meant to copy from disappearing.
    expect(isIgnored('.env.example')).toBe(false)
  })

  it('has never committed a workbook or an environment file', () => {
    // .gitignore does nothing for a file that is already tracked, and nothing
    // at all for one committed before the rule existed. The question is what
    // has ever been in a commit, not what is in the tree today.
    assertHistoryIsPresent()

    const leaked = everyPathEverCommitted().filter(
      (path) => /\.xlsx?$/i.test(path) || (/(^|\/)\.env/.test(path) && !path.endsWith('.env.example'))
    )

    expect(leaked).toEqual([])
  })

  it('has never committed anything shaped like a credential', () => {
    // The control: history has to be readable before "no matches" means
    // anything. An empty stream and a clean stream look the same.
    assertHistoryIsPresent()

    const history = git('log', '-p', '--all')

    const offending = history
      .split('\n')
      .map((line) => CREDENTIAL_SHAPE.exec(line))
      .filter((match) => match !== null)
      // Names the kind of credential and nothing else. A failure message that
      // quotes the match would put the secret into the terminal, into CI logs
      // and into whatever transcript is watching.
      .map((match) => `a ${match[1]} credential, ${match[0].length} characters long`)

    expect(offending).toEqual([])
  })

  it('recognises a credential and ignores prose that merely names one', () => {
    // Sensitivity: assembled at runtime so this file never itself contains a
    // string shaped like a real credential.
    expect(CREDENTIAL_SHAPE.test(`sk_test_${'K3n9Qw'.repeat(8)}`)).toBe(true)
    expect(CREDENTIAL_SHAPE.test(`cfat_${'a1B2c3'.repeat(8)}`)).toBe(true)

    // Specificity: these two lines are really in this repository's history.
    // If the pattern flagged them the check would be noise from day one.
    expect(CREDENTIAL_SHAPE.test("git log -p --all | grep -cE 'cfat_|sk_test_|pk_test_|CONVEX_DEPLOY'")).toBe(false)
    expect(CREDENTIAL_SHAPE.test('value: <the whsec_... value from Step 2>')).toBe(false)
  })

  it('keeps real values out of the one environment file that is committed', () => {
    // The example is the single env file in git, which makes it the one place
    // a real key can be typed in as a helpful default and shipped.
    const example = readFileSync(join(repoRoot, '.env.example'), 'utf8')

    const filledIn = example
      .split('\n')
      .filter((line) => /^[A-Z_][A-Z0-9_]*=.+/.test(line))
      .map((line) => line.split('=')[0])

    expect(filledIn).toEqual([])
    expect(CREDENTIAL_SHAPE.test(example)).toBe(false)
  })
})

describe('the organisation this codebase came from', () => {
  it('leaves no identifier from it anywhere a clone would receive', () => {
    expect(trackedFilesMatching(ORIGIN_IDENTIFIER)).toEqual([])
  })

  it('actually opens the files it searches', () => {
    // The control. A scan that reads nothing — wrong root, a pathspec that
    // excludes everything, a search that errors and is swallowed — reports a
    // clean tree either way.
    expect(trackedFilesMatching(/construction/i).length).toBeGreaterThan(0)
  })

  it('knows an identifier from a word that merely contains one', () => {
    // Sensitivity: the shapes these identifiers actually take.
    expect(ORIGIN_IDENTIFIER.test('flatoutsolutions/github-actions/setup@v1')).toBe(true)
    expect(ORIGIN_IDENTIFIER.test('feature(trucks): assignments [TOWD-5]')).toBe(true)
    expect(ORIGIN_IDENTIFIER.test('cloned from blueprint2')).toBe(true)

    // Specificity: a check that fires on ordinary English is a check that gets
    // deleted, and then the real thing goes through unnoticed.
    expect(ORIGIN_IDENTIFIER.test('laid the foundation towards the second stage')).toBe(false)
    expect(ORIGIN_IDENTIFIER.test('a blueprint for the site')).toBe(false)
  })

  it('no longer answers to the name of the template either', () => {
    // The one the pattern above is written not to catch. It survived in the
    // banner `yarn dev` prints, which is the single line a developer sees on
    // every run — the last place a codebase should still be naming somewhere
    // else.
    expect(trackedFilesMatching(TEMPLATE_NAME)).toEqual([])
  })

  it('recognises the template name in the shapes it took', () => {
    expect(TEMPLATE_NAME.test('echo " BLUEPRINT DEV"')).toBe(true)
    expect(TEMPLATE_NAME.test('cloned from blueprint2')).toBe(true)

    expect(TEMPLATE_NAME.test('sites, trades, people and what they are owed')).toBe(false)
  })
})

describe('the package manager', () => {
  it('is never given away to npm by something committed here', () => {
    expect(trackedFilesMatching(NPM_AS_PACKAGE_MANAGER)).toEqual([])
    expect(git('ls-files', '--', '*package-lock.json').trim()).toBe('')
  })

  it('can see a package manager declaration when there is one', () => {
    // The control. Both files that declare one say yarn; if this found
    // nothing, the check above would be reading past them entirely.
    expect(trackedFilesMatching(/"packageManager": *"yarn/).length).toBeGreaterThan(0)
  })
})

describe('the checks that run before a commit', () => {
  const throwaways: Array<string> = []

  afterEach(() => {
    while (throwaways.length > 0) {
      rmSync(throwaways.pop()!, { recursive: true, force: true })
    }
  })

  /** The line a `git add -p` was told to leave behind. */
  const DECLINED = 'EXPERIMENT_NOT_FOR_COMMIT'

  /**
   * A repository in the ordinary shape of a working tree partway through
   * something: one file staged on purpose, one changed and deliberately left
   * alone, and one staged in part — which is what `git add -p` leaves behind
   * when a hunk is accepted and the next one declined.
   */
  function throwawayRepository(): string {
    const dir = mkdtempSync(join(tmpdir(), 'construction-hook-'))
    throwaways.push(dir)

    const run = (...args: Array<string>) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })

    run('init', '--quiet')
    run('config', 'user.email', 'checks@example.invalid')
    run('config', 'user.name', 'Checks')

    writeFileSync(join(dir, 'meantToCommit.txt'), 'first\n')
    writeFileSync(join(dir, 'halfFinished.txt'), 'first\n')
    writeFileSync(join(dir, 'partlyStaged.txt'), 'first\n')
    run('add', '.')
    run('commit', '--quiet', '-m', 'first')

    writeFileSync(join(dir, 'meantToCommit.txt'), 'second\n')
    run('add', 'meantToCommit.txt')
    writeFileSync(join(dir, 'halfFinished.txt'), 'work in progress\n')

    writeFileSync(join(dir, 'partlyStaged.txt'), 'second\n')
    run('add', 'partlyStaged.txt')
    writeFileSync(join(dir, 'partlyStaged.txt'), `second\n${DECLINED}\n`)

    return dir
  }

  /** Runs the real hook, with the slow commands shimmed out. */
  function runHook(dir: string): void {
    const bin = shimsFor(dir, ['yarn', 'npx'])

    execFileSync('sh', ['-e', join(repoRoot, '.husky', 'pre-commit')], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
    })
  }

  function stagedIn(dir: string): Array<string> {
    return execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: dir, encoding: 'utf8' })
      .split('\n')
      .filter((line) => line.length > 0)
      .sort()
  }

  /** Stands in for the slow commands so the hook's staging can be run on its own. */
  function shimsFor(dir: string, commands: Array<string>, status = 0): string {
    const bin = join(dir, 'shims')
    mkdirSync(bin, { recursive: true })

    for (const command of commands) {
      const path = join(bin, command)
      writeFileSync(path, `#!/bin/sh\nexit ${status}\n`)
      chmodSync(path, 0o755)
    }

    return bin
  }

  it('stage only what the person committing chose to stage', () => {
    // The real hook, run against a throwaway repository with the fixers and
    // codegen shimmed out. Everything it does to the index is its own.
    const dir = throwawayRepository()

    runHook(dir)

    expect(stagedIn(dir)).toEqual(['meantToCommit.txt', 'partlyStaged.txt'])
  })

  it('would have caught the sweep this replaced', () => {
    // The control, and the reason the check above is worth having: `git add
    // -u` after the fixers takes every modified file with it, so a change
    // half-written in another file lands in a commit that never mentions it.
    const dir = throwawayRepository()

    execFileSync('git', ['add', '-u'], { cwd: dir })

    expect(stagedIn(dir)).toEqual(['halfFinished.txt', 'meantToCommit.txt', 'partlyStaged.txt'])
  })

  it('leaves out the hunks the person committing left out', () => {
    // Naming the whole path is not enough. `git add <path>` stages that path's
    // entire working-tree blob, so re-adding after the fixers put back a hunk
    // that a `git add -p` had deliberately declined — into a commit whose
    // author had already looked at it and said no.
    const dir = throwawayRepository()

    runHook(dir)

    const staged = execFileSync('git', ['diff', '--cached'], { cwd: dir, encoding: 'utf8' })

    expect(staged).not.toContain(DECLINED)
    // The control: the hunk that was staged is still staged, so a hook that
    // simply emptied the index would not pass this.
    expect(staged).toContain('+second')
    // And the declined hunk is put back rather than thrown away. Losing it
    // would be a more expensive bug than the one being fixed.
    expect(readFileSync(join(dir, 'partlyStaged.txt'), 'utf8')).toContain(DECLINED)
  })

  it('gives the unstaged work back when a check fails', () => {
    // The hook takes the worktree away for the length of the run, so the case
    // that matters is the one where it does not reach the end. A refused commit
    // is ordinary; a refused commit that keeps somebody's afternoon is not.
    const dir = throwawayRepository()
    const bin = shimsFor(dir, ['yarn', 'npx'], 1)

    expect(() =>
      execFileSync('sh', ['-e', join(repoRoot, '.husky', 'pre-commit')], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
      })
    ).toThrow()

    expect(readFileSync(join(dir, 'partlyStaged.txt'), 'utf8')).toContain(DECLINED)
    expect(readFileSync(join(dir, 'halfFinished.txt'), 'utf8')).toBe('work in progress\n')
    expect(execFileSync('git', ['stash', 'list'], { cwd: dir, encoding: 'utf8' })).toBe('')
  })
})

describe('the checks a commit has to get past', () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string | undefined>
  }

  it('installs the hook under the lifecycle script yarn actually runs', () => {
    // Yarn 4 does not run `prepare` for the root workspace, which is the name
    // husky's own instructions give. Under that name nothing installs the hook,
    // no commit is gated, and every check in this repository still passes —
    // including the one below it, which runs the hook as a file rather than
    // through git.
    expect(manifest.scripts.postinstall).toBe('husky')
    expect(manifest.scripts.prepare).toBeUndefined()
  })

  it('still runs every check in the pipeline, not only in the hook', () => {
    const commands = workflowFiles(repoRoot)
      .flatMap(({ text }) => runStepsIn(text))
      .join('\n')

    for (const check of ['yarn format:check', 'yarn lint:check', 'yarn typecheck', 'yarn test', 'yarn test:scenario']) {
      expect(commands).toContain(check)
    }

    // The controls. A reader that stopped seeing run steps would report every
    // check missing rather than pass on an empty set — but a reader matching
    // far too much would pass on anything, so both directions are pinned.
    expect(runStepsIn(readWorkflow(repoRoot, 'deploy.yml')).length).toBeGreaterThanOrEqual(15)
    expect(commands).not.toContain('yarn nonexistent:check')
  })
})

describe('the deploy pipeline', () => {
  const actionReferences = workflowFiles(repoRoot).flatMap(({ name, text }) =>
    text
      .split('\n')
      .map((line, index) => ({ file: name, line: index + 1, text: line }))
      .filter(({ text: line }) => /^\s*(-\s+)?uses:/.test(line))
      .map((entry) => ({
        ...entry,
        action: entry.text.replace(/^\s*(-\s+)?uses:\s*/, '').trim(),
      }))
  )

  it('reaches only for actions this repository can resolve', () => {
    // The template called a composite action living in a private repository
    // belonging to another organisation. Every job failed on its first step,
    // and nothing in the workflow file looked wrong.
    //
    // Owner allowlist rather than a request to GitHub on purpose: the private
    // action resolved perfectly well for whoever had access to it, which is
    // exactly why it survived into this repository unnoticed.
    const unresolvable = actionReferences
      .filter(({ action }) => !/^(actions|cloudflare)\//.test(action))
      .map(({ file, line, action }) => `${file}:${line} ${action}`)

    expect(unresolvable).toEqual([])
  })

  it('finds the action references it is checking', () => {
    // The control. If the line pattern stopped matching, every workflow would
    // pass the check above by having nothing in it.
    expect(actionReferences.length).toBeGreaterThanOrEqual(5)
  })
})
