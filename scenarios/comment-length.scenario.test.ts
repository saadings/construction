import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

const SOURCE = /\.(ts|tsx|js|mjs|cjs|css|ya?ml|sh)$/

/** Nobody writes these, so a line limit on them would only ever fail. */
const GENERATED = [/^frontend\/src\/routeTree\.gen\.ts$/, /^convex\/_generated\//]

/** Instructions to tooling rather than commentary, so they do not extend a run. */
const DIRECTIVE =
  /(eslint-disable|eslint-enable|@ts-expect-error|@ts-ignore|prettier-ignore|shellcheck|<reference|@vitest-environment)/

const HASH_COMMENTED = /\.(ya?ml|sh)$/

export type CommentRun = { file: string; line: number; length: number; text: string }

function sourceFiles(): Array<string> {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
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
    const probe = join(repoRoot, 'eslint-rules', 'commentProbe.ts')

    function complaintsAbout(source: string): number {
      writeFileSync(probe, source)

      // eslint exits non-zero whenever it reports anything, so the report arrives on the throw as often as on the return.
      let report: string
      try {
        report = execFileSync('npx', ['eslint', '--format', 'json', probe], {
          cwd: repoRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        report = (error as { stdout?: string }).stdout ?? ''
      }

      if (report.trim() === '') throw new Error('eslint produced no report for the probe file')

      return (JSON.parse(report) as Array<{ messages: Array<{ ruleId: string | null }> }>)
        .flatMap((file) => file.messages)
        .filter((message) => message.ruleId === 'local/single-line-comments').length
    }

    try {
      // The control. The rule is loaded and firing, so the zero below means it accepted the shebang rather than that eslint skipped the file.
      expect(complaintsAbout('// One line.\n// And a second, which is one too many.\nexport const probe = 1\n')).toBe(1)

      expect(complaintsAbout('#!/usr/bin/env tsx\n// One line, under a shebang.\nexport const probe = 1\n')).toBe(0)
    } finally {
      rmSync(probe, { force: true })
    }
  }, 180_000)
})
