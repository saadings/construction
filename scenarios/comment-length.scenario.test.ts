import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

import { singleLineComments } from '../eslint-rules/singleLineComments'
import { everyFileHere } from './everyFileHere'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

const SOURCE = /\.(ts|tsx|js|mjs|cjs|css|ya?ml|sh)$/

/** Nobody writes these, so a line limit on them would only ever fail. `components/ui` is shadcn's, copied in by their CLI and updated the same way: held to our rules it reports their style as this repository's problems. */
const GENERATED = [/^frontend\/src\/routeTree\.gen\.ts$/, /^convex\/_generated\//, /^frontend\/src\/components\/ui\//]

/** Instructions to tooling rather than commentary, so they do not extend a run. */
const DIRECTIVE =
  /(eslint-disable|eslint-enable|@ts-expect-error|@ts-ignore|prettier-ignore|shellcheck|<reference|@vitest-environment)/

const HASH_COMMENTED = /\.(ya?ml|sh)$/

export type CommentRun = { file: string; line: number; length: number; text: string }

// Untracked files included, because a sweep of tracked files cannot see the file you just wrote -- and that is the file nobody is sure about. This rule flagged a tracked hook and missed an untracked script with the identical defect, in the same change.
function sourceFiles(): Array<string> {
  return everyFileHere(repoRoot)
    .filter((path) => SOURCE.test(path) || path === '.husky/pre-commit')
    .filter((path) => !GENERATED.some((pattern) => pattern.test(path)))
}

function isCommentLine(file: string, line: string, index: number): boolean {
  const text = line.trim()
  if (index === 0 && text.startsWith('#!')) return false
  if (DIRECTIVE.test(text)) return false
  if (HASH_COMMENTED.test(file) || file === '.husky/pre-commit') return text.startsWith('#')
  return text.startsWith('//') || text.startsWith('/*') || text.startsWith('*') || text.startsWith('*/')
}

/** Every run of adjacent comment-only lines in the given text, longest first. */
export function commentRunsIn(file: string, text: string): Array<CommentRun> {
  const lines = text.split('\n')
  const runs: Array<CommentRun> = []
  let start = -1

  lines.forEach((line, index) => {
    if (isCommentLine(file, line, index)) {
      if (start === -1) start = index
      return
    }
    if (start !== -1) runs.push({ file, line: start + 1, length: index - start, text: lines[start].trim() })
    start = -1
  })

  if (start !== -1) runs.push({ file, line: start + 1, length: lines.length - start, text: lines[start].trim() })

  return runs
}

function offenders(): Array<CommentRun> {
  return sourceFiles()
    .flatMap((file) => commentRunsIn(file, readFileSync(join(repoRoot, file), 'utf8')))
    .filter((run) => run.length > 1)
}

describe('the length of a comment', () => {
  it('is one line, everywhere a person writes one', () => {
    const found = offenders().map((run) => `${run.file}:${run.line} (${run.length} lines) ${run.text}`)

    expect(found).toEqual([])
  })

  it('is measured over files this repository actually has', () => {
    const files = sourceFiles()

    expect(files.length).toBeGreaterThan(20)
    expect(files).toContain('.github/workflows/deploy.yml')
    expect(files).toContain('convex/webhooks/clerk.ts')
    expect(files).not.toContain('frontend/src/routeTree.gen.ts')
  })

  it('catches a run the moment it becomes two lines', () => {
    const two = commentRunsIn('probe.ts', 'const a = 1\n// first\n// second\nconst b = 2\n')

    expect(two).toEqual([{ file: 'probe.ts', line: 2, length: 2, text: '// first' }])
  })

  it('leaves a single line, and two separated by code, alone', () => {
    const runs = commentRunsIn('probe.ts', '// one\nconst a = 1\n// two\nconst b = 2\n')

    expect(runs.filter((run) => run.length > 1)).toEqual([])
  })

  it('counts a block comment, which cannot be written in one line', () => {
    const block = commentRunsIn('probe.ts', '/**\n * why\n */\nconst a = 1\n')

    expect(block.map((run) => run.length)).toEqual([3])
  })

  it('does not count a shebang, or a directive stacked on a comment', () => {
    const shebang = commentRunsIn('probe.sh', '#!/usr/bin/env bash\n# why\nset -e\n')
    const directive = commentRunsIn('probe.ts', '// why\n/* eslint-disable no-console */\nconst a = 1\n')

    expect(shebang.filter((run) => run.length > 1)).toEqual([])
    expect(directive.filter((run) => run.length > 1)).toEqual([])
  })

  it('reads hash comments in yaml and shell, not slashes', () => {
    expect(commentRunsIn('probe.yml', '# one\n# two\njobs: {}\n').map((run) => run.length)).toEqual([2])
    expect(commentRunsIn('probe.yml', '// one\n// two\njobs: {}\n')).toEqual([])
  })

  // The eslint rule is a second implementation of this one, and it disagreed: it read a `#!` line as a comment and failed the line below it.
  it('agrees with the eslint rule that enforces it in TypeScript', () => {
    // In process, never a written file: a probe under `eslint-rules/` is inside tsconfig, and a concurrent typecheck fails when it is cleaned up.
    function complaintsAbout(source: string): number {
      const linter = new Linter()
      const reported = linter.verify(source, {
        plugins: { local: { rules: { 'single-line-comments': singleLineComments } } },
        rules: { 'local/single-line-comments': 'error' },
      })

      return reported.filter((message) => message.ruleId === 'local/single-line-comments').length
    }

    // The control. The rule is loaded and firing, so the zero below means it accepted the shebang rather than that nothing ran.
    expect(complaintsAbout('// One line.\n// And a second, which is one too many.\nexport const probe = 1\n')).toBe(1)

    expect(complaintsAbout('#!/usr/bin/env tsx\n// One line, under a shebang.\nexport const probe = 1\n')).toBe(0)
  })

  it('is the rule this repository actually loads, not one only this test knows about', () => {
    // The other half: verifying a rule in process says nothing about whether eslint is configured to run it.
    const config = readFileSync(join(repoRoot, 'eslint.config.ts'), 'utf8')

    expect(config).toContain('singleLineComments')
    expect(config).toContain("'local/single-line-comments': 'error'")
  })
})
