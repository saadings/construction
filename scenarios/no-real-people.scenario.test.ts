import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

// The workbooks are gitignored because they hold real names, mobile numbers and account digits. Copying a row into a fixture puts them back, permanently, in history.

const SOURCE = /\.(ts|tsx|md)$/

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
])

function digestOf(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex')
}

function trackedSource(): Array<string> {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((path) => SOURCE.test(path))
    .filter((path) => path !== 'scenarios/no-real-people.scenario.test.ts')
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
  return quotedIn(source).filter((quoted) => TAKEN_FROM_THE_WORKBOOKS.has(digestOf(quoted.trim())))
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

  it('catches a real-looking mobile in every form a person writes one', () => {
    // The control, and the reason shape is the test: these are the five forms the parser is fed, and each was a real number.
    for (const written of ['03214276300', '0321-4276300', '0321 4276300', '+923214276300', '92 321 4276300']) {
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
    expect(TAKEN_FROM_THE_WORKBOOKS.size).toBeGreaterThanOrEqual(7)
  })

  it('reads quoted strings out of a file, since that is where a copied value lands', () => {
    const quoted = quotedIn(`const a = 'first'\nconst b = "second"\nconst c = 3\n`)

    expect(quoted).toEqual(['first', 'second'])
  })
})
