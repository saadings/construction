import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DECLINED, discardThrowaways, gitIn, inThrowaway, runHook, stagedIn, throwawayRepository } from './throwaway'
import { readWorkflow, runStepsIn, workflowFiles } from './workflowFile'

// Ways this repository becomes unsafe or unbuildable with no application code changing, each carrying a control: a search matching nothing and a clean tree are byte-identical.

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

function git(...args: Array<string>): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    // Whole-history diffs exceed the default 1 MB buffer, and overflowing throws rather than truncating into a clean-looking history.
    maxBuffer: 512 * 1024 * 1024,
  })
}

// Asked directly because a shallow clone answers with the working tree, and read from `--format=%s` because a patch stream lets this file's own source satisfy the control.
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

// The trailing run of token characters is load-bearing: without it this matches the plan that merely names these prefixes.
const CREDENTIAL_SHAPE = /(cfat_|sk_test_|sk_live_|pk_test_|pk_live_|whsec_)[A-Za-z0-9_+/=-]{20,}/

// Ticket keys are in here because the agent workflows carried no company name at all, so a scan on the name reported a clean tree.
const ORIGIN_IDENTIFIER = /flatout|blueprint.?2|fsos|towd-[0-9]/i

// The pattern above needs the `2` so it cannot fire on ordinary English, and that narrowing is what let the `yarn dev` banner keep naming the template.
const TEMPLATE_NAME = /blueprint/i

// A committed instruction to reach for npm: `.cta.json` carried one, which would leave a package-lock.json beside yarn.lock.
const NPM_AS_PACKAGE_MANAGER = /"packageManager": *"npm/

// Searches staged content, not the working tree, because that is what a clone receives; `docs/` and this file are excluded on purpose.
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
    // git grep exits 1 on no matches and 2+ on real failure; only the first is an answer, and the rest must surface.
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
      'A CLIENT LEDGER.xlsx',
      'frontend/src/fixtures/payments.xlsx',
      'archive/2024.xls',
      '~$construction account.xlsx',
    ]

    const staged = mustBeIgnored.filter((path) => !isIgnored(path))

    expect(staged).toEqual([])
  })

  it('can tell an ignored path from one that is not', () => {
    // The control: a `check-ignore` that always reported "ignored" would pass the test above against an empty .gitignore.
    expect(isIgnored('package.json')).toBe(false)
    expect(isIgnored('convex/schema.ts')).toBe(false)
  })

  it('keeps the example environment file committable', () => {
    // `.env.*` ignores everything, and one `!.env.example` negation is all that keeps the file people copy from.
    expect(isIgnored('.env.example')).toBe(false)
  })

  it('has never committed a workbook or an environment file', () => {
    // .gitignore does nothing for an already-tracked file, so the question is what has ever been committed, not what is here today.
    assertHistoryIsPresent()

    const leaked = everyPathEverCommitted().filter(
      (path) => /\.xlsx?$/i.test(path) || (/(^|\/)\.env/.test(path) && !path.endsWith('.env.example'))
    )

    expect(leaked).toEqual([])
  })

  it('has never committed anything shaped like a credential', () => {
    // The control: an empty stream and a clean stream look the same, so history has to be readable first.
    assertHistoryIsPresent()

    const history = git('log', '-p', '--all')

    const offending = history
      .split('\n')
      .map((line) => CREDENTIAL_SHAPE.exec(line))
      .filter((match) => match !== null)
      // Names the kind of credential only: quoting the match would put the secret into CI logs and any watching transcript.
      .map((match) => `a ${match[1]} credential, ${match[0].length} characters long`)

    expect(offending).toEqual([])
  })

  it('recognises a credential and ignores prose that merely names one', () => {
    // Sensitivity, assembled at runtime so this file holds no string shaped like a real credential.
    expect(CREDENTIAL_SHAPE.test(`sk_test_${'K3n9Qw'.repeat(8)}`)).toBe(true)
    expect(CREDENTIAL_SHAPE.test(`cfat_${'a1B2c3'.repeat(8)}`)).toBe(true)

    // Specificity: these two lines really are in this history, and flagging them would make the check noise from day one.
    expect(CREDENTIAL_SHAPE.test("git log -p --all | grep -cE 'cfat_|sk_test_|pk_test_|CONVEX_DEPLOY'")).toBe(false)
    expect(CREDENTIAL_SHAPE.test('value: <the whsec_... value from Step 2>')).toBe(false)
  })

  it('keeps real values out of the one environment file that is committed', () => {
    // The example is the only env file in git, so it is the one place a real key gets typed in as a helpful default.
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
    // The control: a scan reading nothing — wrong root, everything excluded, a swallowed error — reports a clean tree too.
    expect(trackedFilesMatching(/construction/i).length).toBeGreaterThan(0)
  })

  it('knows an identifier from a word that merely contains one', () => {
    // Sensitivity: the shapes these identifiers actually take.
    expect(ORIGIN_IDENTIFIER.test('flatoutsolutions/github-actions/setup@v1')).toBe(true)
    expect(ORIGIN_IDENTIFIER.test('feature(trucks): assignments [TOWD-5]')).toBe(true)
    expect(ORIGIN_IDENTIFIER.test('cloned from blueprint2')).toBe(true)

    // Specificity: a check firing on ordinary English gets deleted, and then the real thing goes through unnoticed.
    expect(ORIGIN_IDENTIFIER.test('laid the foundation towards the second stage')).toBe(false)
    expect(ORIGIN_IDENTIFIER.test('a blueprint for the site')).toBe(false)
  })

  it('no longer answers to the name of the template either', () => {
    // The one the pattern above is written not to catch, and it survived in the banner `yarn dev` prints on every run.
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
    // The control: both files that declare one say yarn, so finding nothing means the check above reads past them.
    expect(trackedFilesMatching(/"packageManager": *"yarn/).length).toBeGreaterThan(0)
  })
})

describe('the checks that run before a commit', () => {
  afterEach(discardThrowaways)

  it('stage only what the person committing chose to stage', () => {
    // The real hook against a throwaway repository with the fixers shimmed out, so everything it does to the index is its own.
    const dir = throwawayRepository()

    runHook(dir)

    expect(stagedIn(dir)).toEqual(['meantToCommit.txt', 'partlyStaged.txt'])
  })

  it('would have caught the sweep this replaced', () => {
    // The control: `git add -u` after the fixers takes every modified file, so half-written work lands in a commit that never mentions it.
    const dir = throwawayRepository()

    gitIn(dir, 'add', '-u')

    expect(stagedIn(dir)).toEqual(['halfFinished.txt', 'meantToCommit.txt', 'partlyStaged.txt'])
  })

  it('leaves out the hunks the person committing left out', () => {
    // Naming the path is not enough: `git add <path>` stages its whole blob, putting back a hunk the author already declined.
    const dir = throwawayRepository()

    runHook(dir)

    const staged = gitIn(dir, 'diff', '--cached')

    expect(staged).not.toContain(DECLINED)
    // The control: the staged hunk is still staged, so a hook that emptied the index would not pass this.
    expect(staged).toContain('+second')
    // And the declined hunk comes back rather than being thrown away, which would be a costlier bug than the one being fixed.
    expect(readFileSync(join(dir, 'partlyStaged.txt'), 'utf8')).toContain(DECLINED)
  })

  it('gives the unstaged work back when a check fails', () => {
    // The hook takes the worktree away for the run, so what matters is the case where it never reaches the end.
    const dir = throwawayRepository()

    expect(() => runHook(dir, { failing: true })).toThrow()

    expect(readFileSync(join(dir, 'partlyStaged.txt'), 'utf8')).toContain(DECLINED)
    expect(readFileSync(join(dir, 'halfFinished.txt'), 'utf8')).toBe('work in progress\n')
    expect(gitIn(dir, 'stash', 'list')).toBe('')
  })

  it('names, at every one of them, which repository it means', () => {
    // Scans the directory rather than a named file: this guard has twice nearly stopped looking, once when its matcher broke and once when the helpers moved.
    const calls = readdirSync(join(repoRoot, 'scenarios'))
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => childProcessCallsIn(readFileSync(join(repoRoot, 'scenarios', name), 'utf8')))

    const unaimed = calls.filter(
      (call) => !call.includes('cwd: repoRoot') && !call.includes('inThrowaway(') && !call.includes('rev-parse')
    )

    expect(unaimed).toEqual([])
    // The control. A matcher finding nothing passes the line above, and so does a guard pointed at the wrong place.
    expect(calls.length).toBeGreaterThanOrEqual(8)
  })

  it('leaves this repository untouched even when git points every command at it', () => {
    // The hostile environment is passed in, never assigned to process.env — assigning it manufactures the hazard on a plain checkout.
    const dir = throwawayRepository()
    const hostile = {
      ...process.env,
      GIT_DIR: gitDirOfThisRepository(),
      GIT_INDEX_FILE: join(gitDirOfThisRepository(), 'index'),
    }

    const before = stateOfThisRepository()
    execFileSync('git', ['add', '-u'], { cwd: dir, env: inThrowaway(dir, hostile) })

    // HEAD and the tracked count, not file contents: the damage leaves every file on disk untouched.
    expect(stateOfThisRepository()).toEqual(before)
  })
})

// Counts parentheses rather than stopping at the first one: nested join(...) calls truncate a naive match before its env is visible.
function childProcessCallsIn(source: string): Array<string> {
  const calls: Array<string> = []

  for (const match of source.matchAll(/execFileSync\(/g)) {
    let depth = 0
    let index = match.index + match[0].length - 1

    for (; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1
      if (source[index] === ')') depth -= 1
      if (depth === 0) break
    }

    calls.push(source.slice(match.index, index + 1))
  }

  return calls
}

function gitDirOfThisRepository(): string {
  return execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function stateOfThisRepository(): { head: string; tracked: number } {
  return {
    head: git('rev-parse', 'HEAD').trim(),
    tracked: git('ls-files')
      .split('\n')
      .filter((line) => line.length > 0).length,
  }
}

type Manifest = {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

// Binaries the scripts reach for and the manifest has not declared, which resolve by luck out of some other package's tree until an upgrade removes them.
function undeclaredBinaries(manifest: Manifest): Array<string> {
  const shell = new Set(['cd', 'cp', 'mv', 'rm', 'mkdir', 'echo', 'set', 'export', 'true'])
  const runners = new Set(['yarn', 'npx', 'bash', 'sh', 'node'])

  // Where the binary and the package shipping it are named differently.
  const providedBy: Record<string, string> = { tsc: 'typescript' }

  const invoked = new Set(
    Object.values(manifest.scripts ?? {})
      .flatMap((command) => command.split(/&&|\|\||;|\|/))
      .map((segment) => segment.trim().split(/\s+/)[0])
      .filter((binary) => binary.length > 0 && !shell.has(binary) && !runners.has(binary))
  )

  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ])

  return [...invoked].filter((binary) => !declared.has(providedBy[binary] ?? binary)).sort()
}

describe('the commands this project offers', () => {
  it('declares every binary they run', () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as Manifest

    expect(undeclaredBinaries(manifest)).toEqual([])
  })

  it('can see one that is not declared', () => {
    // The control: an extractor matching nothing reports a clean manifest, the same answer a correct one gives.
    expect(
      undeclaredBinaries({
        scripts: { broken: 'somethingNobodyInstalled --flag' },
        devDependencies: { vitest: '^4.0.0' },
      })
    ).toEqual(['somethingNobodyInstalled'])
  })

  it('does not mistake shell plumbing or a runner for a dependency', () => {
    expect(
      undeclaredBinaries({
        scripts: { dev: 'bash scripts/dev.sh', build: 'cd frontend && cp a b', add: 'npx shadcn@latest add' },
      })
    ).toEqual([])
  })
})

describe('the checks a commit has to get past', () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string | undefined>
  }

  it('installs the hook under the lifecycle script yarn actually runs', () => {
    // Yarn 4 does not run `prepare`, the name husky's own instructions give, so nothing installs the hook and every check still passes.
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

    // The controls, pinned in both directions: a reader seeing nothing and one matching everything both pass otherwise.
    expect(runStepsIn(readWorkflow(repoRoot, 'deploy.yml')).length).toBeGreaterThanOrEqual(15)
    expect(commands).not.toContain('yarn nonexistent:check')
  })
})

describe('clickable things look clickable', () => {
  /** The body of the first `@layer base` block, brace-matched rather than guessed at. */
  function baseLayer(): string {
    const styles = readFileSync(join(repoRoot, 'frontend', 'src', 'styles.css'), 'utf8')
    const start = styles.indexOf('@layer base')
    expect(start).toBeGreaterThanOrEqual(0)

    let depth = 0
    for (let index = styles.indexOf('{', start); index < styles.length; index += 1) {
      if (styles[index] === '{') {
        depth += 1
      }
      if (styles[index] === '}') {
        depth -= 1
        if (depth === 0) {
          return styles.slice(start, index + 1)
        }
      }
    }

    throw new Error('The @layer base block in frontend/src/styles.css is not closed')
  }

  it('says so once, centrally', () => {
    // Tailwind's preflight sets no cursor for `button`, and per-element is the version that drifts, since shadcn emits no cursor utility.
    const base = baseLayer()

    expect(base).toContain('cursor: pointer')
    for (const selector of ['button:not(:disabled)', "[role='button']", 'a[href]']) {
      expect(base).toContain(selector)
    }
  })

  it('is not restated on individual elements', () => {
    // The helper excludes this file, so the pattern's own source cannot satisfy the search.
    expect(trackedFilesMatching(/cursor-pointer/)).toEqual([])
  })

  it('would notice the utility if it came back', () => {
    // The control for the search above.
    expect(trackedFilesMatching(/cursor: pointer/).length).toBeGreaterThan(0)
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
    // An owner allowlist rather than a request to GitHub, because the template's private action resolved fine for whoever had access to it.
    const unresolvable = actionReferences
      .filter(({ action }) => !/^(actions|cloudflare)\//.test(action))
      .map(({ file, line, action }) => `${file}:${line} ${action}`)

    expect(unresolvable).toEqual([])
  })

  it('finds the action references it is checking', () => {
    // The control: if the line pattern stopped matching, every workflow would pass above by having nothing in it.
    expect(actionReferences.length).toBeGreaterThanOrEqual(5)
  })
})

describe('a worktree opened inside the repository', () => {
  const worktrees = join(repoRoot, '.claude', 'worktrees')
  const nested = join(worktrees, 'probe')
  const probe = join(nested, 'nested.scenario.test.ts')
  const control = join(repoRoot, 'scenarios', 'control.scenario.test.ts')

  afterEach(() => {
    rmSync(nested, { recursive: true, force: true })
    rmSync(control, { force: true })
  })

  it('is neither committed with this branch nor read as part of it', () => {
    const body = "import { it } from 'vitest'\n\nit('placeholder', () => {})\n"

    mkdirSync(nested, { recursive: true })
    writeFileSync(probe, body)
    writeFileSync(control, body)

    // An agent session's worktree is another branch's whole checkout, one `git add -A` away from being committed here.
    expect(isIgnored('.claude/worktrees/probe/nested.scenario.test.ts')).toBe(true)

    const collected = execFileSync('npx', ['vitest', 'list', '--config', 'vitest.scenario.config.ts'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    // The control, and why this is a probe rather than a config read: a `vitest list` printing nothing satisfies the assertion below just as well.
    expect(collected).toContain('control.scenario.test.ts')

    // Left in, every scenario runs twice, the second time against work not in this commit.
    expect(collected).not.toContain('nested.scenario.test.ts')
  }, 60_000)
})
