import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

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
    const leaked = everyPathEverCommitted().filter(
      (path) => /\.xlsx?$/i.test(path) || (/(^|\/)\.env/.test(path) && !path.endsWith('.env.example'))
    )

    expect(leaked).toEqual([])
  })

  it('has never committed anything shaped like a credential', () => {
    const history = git('log', '-p', '--all')

    // The control: history has to be readable before "no matches" means
    // anything. An empty stream and a clean stream look the same.
    expect(history).toContain('bring in the application codebase')

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
})

describe('the deploy pipeline', () => {
  const workflows = join(repoRoot, '.github', 'workflows')

  const actionReferences = readdirSync(workflows)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((name) =>
      readFileSync(join(workflows, name), 'utf8')
        .split('\n')
        .map((text, index) => ({ file: name, line: index + 1, text }))
        .filter(({ text }) => /^\s*(-\s+)?uses:/.test(text))
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
