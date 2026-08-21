import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

// The workbooks are gitignored because they hold real names, mobile numbers and account digits. Copying a row into a fixture puts them back, permanently, in history.

const SOURCE = /\.(ts|tsx|md|json|ya?ml|sh|css)$/

// A lockfile is machine-written hexadecimal, and a short run of digits inside a checksum is not somebody's account number.
const MACHINE_WRITTEN = /(^|\/)(yarn\.lock|package-lock\.json|pnpm-lock\.yaml)$|-lock\.json$/

/** A Pakistani mobile in any form a person writes one. Shape is enough: nobody needs a real number to test a parser. */
const A_MOBILE = /(?:\+?92[- ]?|0)3\d{2}[- ]?\d{7}\b/g

/** All-zero subscriber digits, which no network issues and no workbook contains. */
const OBVIOUSLY_MADE_UP = /^(?:\+?92[- ]?|0)3\d{2}[- ]?0{7}$/

// The names and labels already found in the tests, kept as digests: writing them here to guard against them would put them back in the repository.
const TAKEN_FROM_THE_WORKBOOKS = new Set([
  '22ac1b83b6543ea0e164804e90620c1a6f97552ffd20e42fb7328371e2a69634',
  '8113fcbecbc446f0367d65a2bad063ace3c1882c1a240e6821b15d585a8d6c72',
  'ba89d7aacb5d9d0649f483aaacc6bbf66813b18d28f0d97a79bf2777c52d8410',
  'abc1bf9cc40b503f554436a8c208c5fd829738a8f87eddfc71a081e28e89d599',
  '67a86e3e7bd2443f6d2c2909dba371dda1642d0d79df3004fef75da317522433',
  '11d7cdb02b19aeffbdc59eeff157f1fd6f0248df3596ed729fd77f18493fe865',
  '6481ce0d69b3183f965186e1266ed4a0931a89bbfa82a213c5fd42904996ef4c',
  '97b3650166ce2517ed20c1eb1567c1c8570832a16d239a3bb8762cc529b8fb71',
  '5f14e72d515e753ca29c94e56cf339a8358067cbbb425dfe8cb2974bdbd1fc45',
  '419573d7148745facdb9f434151c16a7517525632e63081e78b431172f70369c',
  '18838d4a59181e4c5021eb2b012e845730302b49bd9f851d3358ae353eb0793c',
  '3885fcc7202149913b8205e5b8eb9fa7b7f0597fdb461732206b8baffa67c76b',
  '707f6b27b35675b3ef29ba1e1075c03324e79f8796f43e5a99e76e098ee12b64',
  '1521628568a3e2c3f6455cab87d6f10167816c770ba4f9dc36dfd80385b8f6af',
  '0f33e04ac3b3762d50f9530393b85019c1d935777def125e9ac56fcea8622c1f',
  '9587740ea2f5a2d997b84ba6d1b07977abbc1487c7125bb115dc00d9bb823ca2',
  'fea25466ffad9fef240652204f67597d201c902f6ed1482dc493c457aef2abec',
  'fe0d97d1ae2ace37941f95ae252ac3cd156300cf7a48be9412395a0b4399a0b6',
  '3027cf0ecb7b75810d2f396966e686be0459f8adf2bb1808f3d3e84608b1907d',
  '94e4f0c813bd4d9dba190ac985d3f85390d68df1eaff77c1cc2954f7cfd1ddfc',
  '9af2921d3fd57fe886c9022d1fcc055d53a79e4032fa6137e397583884e1a5de',
  '9e742dec65d49f1d078c0508e17eb547e0f79a86c20d6d850dedcadfe5627889',
  'e6d05e580635a8f66551a34534761aaa11e0fa692697eb4c0acac49b82ab89d5',
])

function digestOf(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex')
}

function trackedSource(): Array<string> {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((path) => SOURCE.test(path))
    .filter((path) => !MACHINE_WRITTEN.test(path))
    .filter((path) => path !== 'scenarios/no-real-people.scenario.test.ts')
}

// A value removed as part of a longer one is itself a known-bad value: the label went and the four digits it was renamed for stayed, in another file, in a field of their own.

// And a value scrubbed in one commit while this list was built in another is a value with nothing behind it: both houses were replaced everywhere and neither was ever written down here, so either could come back and this would say nothing.

// A digest carrying punctuation is reachable only when a whole quoted string matches it, because the word reader splits on punctuation. So `359-R` is written down the way that reader sees it as well.

/** Every run of one to three words, punctuation and line breaks ignored, so a name wrapped across two lines and a fragment sitting alone both read the same. */
export function wordRunsIn(source: string): Array<string> {
  const words = source.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 0)
  const runs: Array<string> = []

  for (let at = 0; at < words.length; at += 1) {
    for (let long = 1; long <= 3 && at + long <= words.length; long += 1) {
      runs.push(words.slice(at, at + long).join(' '))
    }
  }

  return runs
}

/** Every quoted string in a file, which is where a copied-in name or number lands. */
export function quotedIn(source: string): Array<string> {
  return [...source.matchAll(/'([^'\n]{2,60})'|"([^"\n]{2,60})"/g)].map((match) => match[1] ?? match[2])
}

/** A mobile number that is not plainly invented. */
export function realLookingMobilesIn(source: string): Array<string> {
  return [...source.matchAll(A_MOBILE)].map((match) => match[0]).filter((found) => !OBVIOUSLY_MADE_UP.test(found))
}

/** A string whose digest is one taken from the workbooks. */
export function fromTheWorkbooksIn(source: string): Array<string> {
  const found = [...quotedIn(source), ...wordRunsIn(source)].filter((candidate) =>
    TAKEN_FROM_THE_WORKBOOKS.has(digestOf(candidate.trim()))
  )

  return [...new Set(found)]
}

describe('what a fixture is allowed to be made of', () => {
  const files = trackedSource().map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }))

  it('holds no mobile number that was not plainly invented', () => {
    const found = files.flatMap(({ path, text }) => realLookingMobilesIn(text).map(() => `${path} carries one`))

    expect(found).toEqual([])
  })

  it('holds nothing copied out of the workbooks', () => {
    // Matched by digest, because naming the values here to guard against them would be putting them back.
    const found = files.flatMap(({ path, text }) => fromTheWorkbooksIn(text).map(() => `${path} carries one`))

    expect(found).toEqual([])
  })

  it('is read over the files this repository actually has', () => {
    // The floor. Both checks above return nothing when nothing is read, which is what a clean tree returns.
    const paths = files.map((file) => file.path)

    expect(paths.length).toBeGreaterThan(20)
    expect(paths).toContain('convex/people/mutations.test.ts')
    expect(paths).toContain('shared/validation/primitives.test.ts')
  })

  it('reads the kinds of file a value actually lands in', () => {
    // Real data has turned up in a scenario file and in a spec already, so "nobody would paste it into a workflow" is not an argument that has survived.
    const paths = files.map((file) => file.path)

    expect(paths).toContain('.github/workflows/deploy.yml')
    expect(paths).toContain('scripts/reclaimPort.sh')
    expect(paths).toContain('package.json')
    expect(paths).toContain('frontend/src/styles.css')
  })

  it('cannot reach an ignored file, which is what the workbooks are', () => {
    // They hold account numbers, mobile numbers and named clients' records, and they are ignored rather than absent. `git ls-files` lists the index alone; asking it for ignored or untracked files takes a flag, and this asserts that flag is not there.

    // Two other sweeps here take `--others --exclude-standard`, because a sweep of tracked files cannot see the file you just wrote. This one deliberately does not, and the reason is not that the flags would reach the workbooks -- `--exclude-standard` keeps the ignore rules, so mechanically they would not.

    // It is that this guard **reports what it finds**, naming the file and quoting the offending words, and this repository is public. A version able to reach those files would print an excerpt of a real client's record into a CI log on the day it matched: the guard doing its job would be the leak.

    // So the blindness is a property rather than a limitation. `it cannot ask` is a sentence that cannot be half-true; the alternative rests on a flag combination staying right forever, on the one sweep here whose failure mode is publishing.

    // What that costs is only the hand-run: husky stages before the hook runs, so at the moment this is enforced the file is tracked and is swept. Somebody will arrive with the widening argument -- two of us did -- and this is the answer to it.
    const guard = readFileSync(join(repoRoot, 'scenarios', 'no-real-people.scenario.test.ts'), 'utf8')
    const everyGitCall = [...guard.matchAll(/execFileSync\('git', \[([^\]]*)\]/g)].map((call) => call[1])
    const asksGitFor = everyGitCall.find((call) => call.includes("'ls-files'")) ?? ''

    expect(asksGitFor, 'the guard no longer lists files with git').toContain("'ls-files'")
    expect(asksGitFor).not.toContain('--others')
    expect(asksGitFor).not.toContain('--ignored')

    expect(files.map((file) => file.path).filter((path) => path.endsWith('.xlsx'))).toEqual([])
  })

  it('has the workbooks beside it and reads none of them, where they are present', () => {
    // Only where they are. CI checks out none of them, so the mechanism above is what holds everywhere and this is what confirms it on the machine that has them.
    const onDisk = readdirSync(repoRoot).filter((name) => name.endsWith('.xlsx'))
    if (onDisk.length === 0) {
      expect(files.map((file) => file.path).filter((path) => path.endsWith('.xlsx'))).toEqual([])
      return
    }

    expect(onDisk.length).toBeGreaterThan(0)
    expect(files.map((file) => file.path).some((path) => onDisk.includes(path))).toBe(false)
  })

  it('says which file, never what it found', () => {
    // A guard that prints what it matched reproduces it in every terminal and CI log that captures the run.
    const said = fromTheWorkbooksIn("const copied = 'A canary proving the digest path works'").map(
      () => 'somefile.ts carries one'
    )

    expect(said).toEqual(['somefile.ts carries one'])
    expect(said.join(' ')).not.toContain('canary proving')
  })

  it('catches a real-looking mobile in every form a person writes one', () => {
    // The control, and the reason shape is the test: these are the five forms a person writes one in.

    // They were a **real number**, in this file, on a public repository, in the guard whose whole subject is keeping real people out of the suite -- and the comment above them said so in as many words. The rule reads the working tree and never its own plants' provenance, so nothing it does could have caught this.

    // `0321-0000001` is real-looking by every measure the rule uses -- a live prefix and seven subscriber digits -- and is not the all-zero shape below, so both halves of this file still mean what they say. Whether it belongs to anybody is not knowable from here, which is the honest limit: the last digit is the only thing standing between an invented number and somebody's.
    for (const written of ['03210000001', '0321-0000001', '0321 0000001', '+923210000001', '92 321 0000001']) {
      expect(realLookingMobilesIn(`const typed = '${written}'`), written).toHaveLength(1)
    }
  })

  it('leaves an invented one alone, so the rule is not simply refusing every number', () => {
    for (const written of ['03000000000', '0300-0000000', '0300 0000000', '+923000000000']) {
      expect(realLookingMobilesIn(`const typed = '${written}'`), written).toEqual([])
    }

    // And a figure of money is not a phone number, however long.
    expect(realLookingMobilesIn('const total = 11_798_452')).toEqual([])
  })

  it('catches a value copied back in, by digest rather than by naming it', () => {
    // The last digest in the list is this sentence, put there so the whole path can be proved without a real name appearing anywhere.
    const canary = 'A canary proving the digest path works'

    expect(fromTheWorkbooksIn(`const copied = '${canary}'`)).toEqual([canary])

    // And it is found however it was pasted, since a name copied out of a sheet arrives with its spacing and its capitals.
    expect(fromTheWorkbooksIn(`const copied = ' ${canary.toUpperCase()} '`)).toHaveLength(1)
  })

  it('leaves an ordinary string alone, so the rule is not refusing everything quoted', () => {
    // The other half. A list that matched every string would satisfy the check above while making the guard useless.
    expect(fromTheWorkbooksIn("const trade = 'Cement'\nconst site = 'A house'")).toEqual([])
    expect(TAKEN_FROM_THE_WORKBOOKS.size).toBeGreaterThanOrEqual(9)
  })

  it('reads quoted strings out of a file, since that is where a copied value lands', () => {
    const quoted = quotedIn(`const a = 'first'\nconst b = "second"\nconst c = 3\n`)

    expect(quoted).toEqual(['first', 'second'])
  })
})
